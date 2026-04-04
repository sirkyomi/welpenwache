using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Security;

var builder = WebApplication.CreateBuilder(args);
var jwtOptions = JwtOptions.Resolve(builder.Configuration, builder.Environment);

builder.Services.AddSingleton(jwtOptions);
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(DesignTimeDbContextFactory.ResolveConnectionString(builder.Configuration));
});
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Policies.AdminOnly, policy =>
        policy.RequireAssertion(context => context.User.IsAdministrator()));

    foreach (var permission in PermissionCatalog.All)
    {
        options.AddPolicy(permission, policy =>
            policy.RequireAssertion(context =>
                context.User.IsAdministrator() || context.User.HasPermission(permission)));
    }
});
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"])
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

var setupGroup = app.MapGroup("/api/setup");
setupGroup.MapGet("/status", async (ApplicationDbContext dbContext) =>
{
    var requiresSetup = !await dbContext.Users.AnyAsync();
    return Results.Ok(new SetupStatusResponse(requiresSetup));
});

setupGroup.MapPost("/admin", async (
    SetupAdminRequest request,
    ApplicationDbContext dbContext,
    JwtTokenService tokenService) =>
{
    var userName = request.UserName.Trim();

    if (await dbContext.Users.AnyAsync())
    {
        return Results.Conflict(new ApiError("SETUP_COMPLETED", "Die Initialkonfiguration wurde bereits abgeschlossen."));
    }

    if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Benutzername und Passwort mit mindestens 8 Zeichen sind erforderlich."));
    }

    var adminUser = new UserAccount
    {
        UserName = userName,
        NormalizedUserName = NormalizeKey(userName),
        PasswordHash = PasswordHasher.Hash(request.Password),
        IsAdministrator = true,
        ThemePreference = UserAccount.ThemeSystem
    };

    adminUser.Permissions.AddRange(PermissionCatalog.All.Select(permission => new UserPermission
    {
        Permission = permission
    }));

    dbContext.Users.Add(adminUser);
    await dbContext.SaveChangesAsync();

    return Results.Created("/api/setup/status", tokenService.CreateToken(adminUser));
});

var authGroup = app.MapGroup("/api/auth");
authGroup.MapPost("/login", async (
    LoginRequest request,
    ApplicationDbContext dbContext,
    JwtTokenService tokenService) =>
{
    var userName = request.UserName.Trim();
    var normalizedUserName = NormalizeKey(userName);

    if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Benutzername und Passwort sind erforderlich."));
    }

    var user = await dbContext.Users
        .Include(item => item.Permissions)
        .SingleOrDefaultAsync(item => item.NormalizedUserName == normalizedUserName);

    if (user is null || !user.IsActive || !PasswordHasher.Verify(request.Password, user.PasswordHash))
    {
        return Results.Unauthorized();
    }

    return Results.Ok(tokenService.CreateToken(user));
});

authGroup.MapGet("/me", [Authorize] async (
    ClaimsPrincipal principal,
    ApplicationDbContext dbContext) =>
{
    var userId = principal.GetUserId();
    var user = await dbContext.Users
        .Include(item => item.Permissions)
        .SingleOrDefaultAsync(item => item.Id == userId);

    return user is null
        ? Results.NotFound(new ApiError("USER_NOT_FOUND", "Der Benutzer wurde nicht gefunden."))
        : Results.Ok(user.ToResponse());
});

authGroup.MapPut("/theme", [Authorize] async (
    UpdateThemePreferenceRequest request,
    ClaimsPrincipal principal,
    ApplicationDbContext dbContext) =>
{
    if (!UserAccount.IsValidThemePreference(request.ThemePreference))
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Die Theme-Einstellung ist ungueltig."));
    }

    var userId = principal.GetUserId();
    var user = await dbContext.Users
        .Include(item => item.Permissions)
        .SingleOrDefaultAsync(item => item.Id == userId);

    if (user is null)
    {
        return Results.NotFound(new ApiError("USER_NOT_FOUND", "Der Benutzer wurde nicht gefunden."));
    }

    user.ThemePreference = request.ThemePreference;
    await dbContext.SaveChangesAsync();

    return Results.Ok(user.ToResponse());
});

var usersGroup = app.MapGroup("/api/users")
    .RequireAuthorization(Policies.AdminOnly);

usersGroup.MapGet("/", async (ApplicationDbContext dbContext) =>
{
    var users = await dbContext.Users
        .Include(item => item.Permissions)
        .OrderBy(item => item.UserName)
        .ToListAsync();

    return Results.Ok(users.Select(item => item.ToResponse()));
});

usersGroup.MapPost("/", async (CreateUserRequest request, ApplicationDbContext dbContext) =>
{
    var userName = request.UserName.Trim();
    var normalizedUserName = NormalizeKey(userName);
    var permissionValidationError = ValidatePermissions(request.Permissions);

    if (permissionValidationError is not null)
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", permissionValidationError));
    }

    if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Benutzername und Passwort mit mindestens 8 Zeichen sind erforderlich."));
    }

    if (await dbContext.Users.AnyAsync(item => item.NormalizedUserName == normalizedUserName))
    {
        return Results.Conflict(new ApiError("USERNAME_EXISTS", "Der Benutzername ist bereits vergeben."));
    }

    var user = new UserAccount
    {
        UserName = userName,
        NormalizedUserName = normalizedUserName,
        PasswordHash = PasswordHasher.Hash(request.Password),
        IsAdministrator = request.IsAdministrator,
        IsActive = request.IsActive,
        ThemePreference = UserAccount.ThemeSystem
    };

    user.Permissions.AddRange(request.Permissions
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Select(permission => new UserPermission
        {
            Permission = permission
        }));

    dbContext.Users.Add(user);
    await dbContext.SaveChangesAsync();

    return Results.Created($"/api/users/{user.Id}", user.ToResponse());
});

usersGroup.MapPut("/{id:guid}", async (
    Guid id,
    UpdateUserRequest request,
    ClaimsPrincipal principal,
    ApplicationDbContext dbContext) =>
{
    var user = await dbContext.Users
        .Include(item => item.Permissions)
        .SingleOrDefaultAsync(item => item.Id == id);

    if (user is null)
    {
        return Results.NotFound(new ApiError("USER_NOT_FOUND", "Der Benutzer wurde nicht gefunden."));
    }

    var userName = request.UserName.Trim();
    var normalizedUserName = NormalizeKey(userName);
    var permissionValidationError = ValidatePermissions(request.Permissions);

    if (permissionValidationError is not null)
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", permissionValidationError));
    }

    if (string.IsNullOrWhiteSpace(userName))
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Der Benutzername ist erforderlich."));
    }

    if (!string.IsNullOrWhiteSpace(request.NewPassword) && request.NewPassword.Length < 8)
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Ein neues Passwort muss mindestens 8 Zeichen lang sein."));
    }

    if (await dbContext.Users.AnyAsync(item => item.Id != id && item.NormalizedUserName == normalizedUserName))
    {
        return Results.Conflict(new ApiError("USERNAME_EXISTS", "Der Benutzername ist bereits vergeben."));
    }

    if (principal.GetUserId() == id && !request.IsActive)
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Der eigene Benutzer kann nicht deaktiviert werden."));
    }

    if (user.IsAdministrator && !request.IsAdministrator)
    {
        var anotherAdminExists = await dbContext.Users.AnyAsync(item => item.Id != id && item.IsAdministrator && item.IsActive);
        if (!anotherAdminExists)
        {
            return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Es muss mindestens ein aktiver Administrator vorhanden bleiben."));
        }
    }

    user.UserName = userName;
    user.NormalizedUserName = normalizedUserName;
    user.IsAdministrator = request.IsAdministrator;
    user.IsActive = request.IsActive;

    if (!string.IsNullOrWhiteSpace(request.NewPassword))
    {
        user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
    }

    user.Permissions.Clear();
    user.Permissions.AddRange(request.Permissions
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Select(permission => new UserPermission
        {
            UserAccountId = user.Id,
            Permission = permission
        }));

    await dbContext.SaveChangesAsync();
    return Results.Ok(user.ToResponse());
});

var teamsGroup = app.MapGroup("/api/teams").RequireAuthorization();

teamsGroup.MapGet("/", async (ClaimsPrincipal principal, ApplicationDbContext dbContext) =>
{
    if (!CanAccessTeams(principal))
    {
        return Results.Forbid();
    }

    var teams = await dbContext.Teams
        .OrderBy(team => team.IsArchived)
        .ThenBy(team => team.Name)
        .ToListAsync();

    return Results.Ok(teams.Select(team => team.ToResponse()));
});

teamsGroup.MapGet("/{id:guid}", async (
    Guid id,
    ClaimsPrincipal principal,
    ApplicationDbContext dbContext) =>
{
    if (!CanAccessTeams(principal))
    {
        return Results.Forbid();
    }

    var team = await dbContext.Teams
        .Include(item => item.Assignments)
            .ThenInclude(assignment => assignment.Internship)
                .ThenInclude(internship => internship.Intern)
        .SingleOrDefaultAsync(item => item.Id == id);

    return team is null
        ? Results.NotFound(new ApiError("TEAM_NOT_FOUND", "Das Team wurde nicht gefunden."))
        : Results.Ok(team.ToDetailResponse());
});

teamsGroup.MapPost("/", [Authorize(Policy = PermissionCatalog.TeamsManage)] async (
    TeamRequest request,
    ApplicationDbContext dbContext) =>
{
    var validationError = await ValidateTeamAsync(request, dbContext, null);
    if (validationError is not null)
    {
        return Results.BadRequest(validationError);
    }

    var team = new Team
    {
        Name = request.Name.Trim(),
        NormalizedName = NormalizeKey(request.Name),
        Description = request.Description?.Trim(),
        ColorHex = NormalizeColor(request.ColorHex),
        IsArchived = request.IsArchived
    };

    dbContext.Teams.Add(team);
    await dbContext.SaveChangesAsync();
    return Results.Created($"/api/teams/{team.Id}", team.ToResponse());
});

teamsGroup.MapPut("/{id:guid}", [Authorize(Policy = PermissionCatalog.TeamsManage)] async (
    Guid id,
    TeamRequest request,
    ApplicationDbContext dbContext) =>
{
    var team = await dbContext.Teams.SingleOrDefaultAsync(item => item.Id == id);
    if (team is null)
    {
        return Results.NotFound(new ApiError("TEAM_NOT_FOUND", "Das Team wurde nicht gefunden."));
    }

    var validationError = await ValidateTeamAsync(request, dbContext, id);
    if (validationError is not null)
    {
        return Results.BadRequest(validationError);
    }

    team.Name = request.Name.Trim();
    team.NormalizedName = NormalizeKey(request.Name);
    team.Description = request.Description?.Trim();
    team.ColorHex = NormalizeColor(request.ColorHex);
    team.IsArchived = request.IsArchived;

    await dbContext.SaveChangesAsync();
    return Results.Ok(team.ToResponse());
});

teamsGroup.MapDelete("/{id:guid}", [Authorize(Policy = PermissionCatalog.TeamsManage)] async (
    Guid id,
    ApplicationDbContext dbContext) =>
{
    var team = await dbContext.Teams.SingleOrDefaultAsync(item => item.Id == id);
    if (team is null)
    {
        return Results.NotFound(new ApiError("TEAM_NOT_FOUND", "Das Team wurde nicht gefunden."));
    }

    var hasAssignments = await dbContext.Assignments.AnyAsync(item => item.TeamId == id);
    if (hasAssignments)
    {
        return Results.BadRequest(new ApiError("TEAM_IN_USE", "Teams mit bestehenden Zuweisungen koennen nicht geloescht werden."));
    }

    dbContext.Teams.Remove(team);
    await dbContext.SaveChangesAsync();
    return Results.NoContent();
});

var internsGroup = app.MapGroup("/api/interns")
    .RequireAuthorization(PermissionCatalog.InternsView);

internsGroup.MapGet("/", async (ApplicationDbContext dbContext) =>
{
    var interns = await dbContext.Interns
        .Include(item => item.Internships)
            .ThenInclude(internship => internship.Assignments)
                .ThenInclude(assignment => assignment.Team)
        .OrderBy(item => item.LastName)
        .ThenBy(item => item.FirstName)
        .ToListAsync();

    return Results.Ok(interns.Select(item => item.ToResponse()));
});

internsGroup.MapGet("/{id:guid}", async (Guid id, ApplicationDbContext dbContext) =>
{
    var intern = await dbContext.Interns
        .Include(item => item.Internships)
            .ThenInclude(internship => internship.Assignments)
                .ThenInclude(assignment => assignment.Team)
        .SingleOrDefaultAsync(item => item.Id == id);

    return intern is null
        ? Results.NotFound(new ApiError("INTERN_NOT_FOUND", "Der Praktikant wurde nicht gefunden."))
        : Results.Ok(intern.ToResponse());
});

internsGroup.MapPost("/", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
    InternRequest request,
    ApplicationDbContext dbContext) =>
{
    var validationError = await ValidateInternRequestAsync(request, dbContext);
    if (validationError is not null)
    {
        return Results.BadRequest(validationError);
    }

    var intern = request.ToEntity();
    dbContext.Interns.Add(intern);
    await dbContext.SaveChangesAsync();

    var createdIntern = await dbContext.Interns
        .Include(item => item.Internships)
            .ThenInclude(internship => internship.Assignments)
                .ThenInclude(assignment => assignment.Team)
        .SingleAsync(item => item.Id == intern.Id);

    return Results.Created($"/api/interns/{intern.Id}", createdIntern.ToResponse());
});

internsGroup.MapPut("/{id:guid}", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
    Guid id,
    InternRequest request,
    ApplicationDbContext dbContext) =>
{
    var existingIntern = await dbContext.Interns
        .SingleOrDefaultAsync(item => item.Id == id);

    if (existingIntern is null)
    {
        return Results.NotFound(new ApiError("INTERN_NOT_FOUND", "Der Praktikant wurde nicht gefunden."));
    }

    var validationError = await ValidateInternRequestAsync(request, dbContext);
    if (validationError is not null)
    {
        return Results.BadRequest(validationError);
    }

    existingIntern.FirstName = request.FirstName.Trim();
    existingIntern.LastName = request.LastName.Trim();
    existingIntern.School = request.School?.Trim();
    existingIntern.Notes = request.Notes?.Trim();

    await using var transaction = await dbContext.Database.BeginTransactionAsync();

    await dbContext.Internships
        .Where(internship => internship.InternId == id)
        .ExecuteDeleteAsync();

    var replacementInternships = request.Internships
        .OrderBy(internship => internship.StartDate)
        .Select(internship => new Internship
        {
            InternId = id,
            StartDate = internship.StartDate,
            EndDate = internship.EndDate,
            Note = internship.Note?.Trim(),
            Assignments = internship.Assignments
                .OrderBy(assignment => assignment.StartDate)
                .Select(assignment => new InternshipAssignment
                {
                    TeamId = assignment.TeamId,
                    StartDate = assignment.StartDate,
                    EndDate = assignment.EndDate
                })
                .ToList()
        })
        .ToList();

    if (replacementInternships.Count > 0)
    {
        dbContext.Internships.AddRange(replacementInternships);
    }

    await dbContext.SaveChangesAsync();
    await transaction.CommitAsync();

    var updatedIntern = await dbContext.Interns
        .AsNoTracking()
        .Include(item => item.Internships)
            .ThenInclude(internship => internship.Assignments)
                .ThenInclude(assignment => assignment.Team)
        .SingleAsync(item => item.Id == id);

    return Results.Ok(updatedIntern.ToResponse());
});

internsGroup.MapDelete("/{id:guid}", [Authorize(Policy = PermissionCatalog.InternsManage)] async (
    Guid id,
    ApplicationDbContext dbContext) =>
{
    var intern = await dbContext.Interns.SingleOrDefaultAsync(item => item.Id == id);
    if (intern is null)
    {
        return Results.NotFound(new ApiError("INTERN_NOT_FOUND", "Der Praktikant wurde nicht gefunden."));
    }

    dbContext.Interns.Remove(intern);
    await dbContext.SaveChangesAsync();
    return Results.NoContent();
});

var calendarGroup = app.MapGroup("/api/calendar")
    .RequireAuthorization(PermissionCatalog.InternsView);

calendarGroup.MapGet("/month", async (int year, int month, ApplicationDbContext dbContext) =>
{
    if (year is < 2000 or > 2100 || month is < 1 or > 12)
    {
        return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Jahr oder Monat sind ungueltig."));
    }

    var monthStart = new DateOnly(year, month, 1);
    var monthEnd = monthStart.AddMonths(1).AddDays(-1);

    var internships = await dbContext.Internships
        .Include(internship => internship.Intern)
        .Include(internship => internship.Assignments)
            .ThenInclude(assignment => assignment.Team)
        .Where(internship => internship.EndDate >= monthStart && internship.StartDate <= monthEnd)
        .OrderBy(internship => internship.StartDate)
        .ThenBy(internship => internship.Intern.LastName)
        .ToListAsync();

    var days = Enumerable.Range(0, monthEnd.Day)
        .Select(offset =>
        {
            var date = monthStart.AddDays(offset);
            var entries = internships
                .SelectMany(internship => internship.Assignments
                    .Where(assignment => assignment.StartDate <= date && assignment.EndDate >= date)
                    .Select(assignment => new CalendarDayEntryResponse(
                        internship.InternId,
                        internship.Intern.FullName,
                        internship.Id,
                        assignment.TeamId,
                        assignment.Team.Name,
                        assignment.Team.ColorHex)))
                .OrderBy(entry => entry.TeamName)
                .ThenBy(entry => entry.InternName)
                .ToList();

            return new CalendarDayResponse(date, entries);
        })
        .ToList();

    return Results.Ok(new CalendarMonthResponse(year, month, days));
});

app.Run();

static string? ValidatePermissions(IEnumerable<string> permissions)
{
    return permissions.Except(PermissionCatalog.All, StringComparer.OrdinalIgnoreCase).Any()
        ? "Mindestens eine Berechtigung ist ungueltig."
        : null;
}

static async Task<ApiError?> ValidateTeamAsync(TeamRequest request, ApplicationDbContext dbContext, Guid? currentTeamId)
{
    if (string.IsNullOrWhiteSpace(request.Name))
    {
        return new ApiError("VALIDATION_ERROR", "Der Teamname ist erforderlich.");
    }

    var normalizedName = NormalizeKey(request.Name);
    var duplicateExists = await dbContext.Teams.AnyAsync(item => item.Id != currentTeamId && item.NormalizedName == normalizedName);
    if (duplicateExists)
    {
        return new ApiError("TEAM_EXISTS", "Ein Team mit diesem Namen existiert bereits.");
    }

    if (!string.IsNullOrWhiteSpace(request.ColorHex) && !Regex.IsMatch(request.ColorHex, "^#[0-9A-Fa-f]{6}$"))
    {
        return new ApiError("VALIDATION_ERROR", "Die Teamfarbe muss als HEX-Wert wie #2563EB angegeben werden.");
    }

    return null;
}

static async Task<ApiError?> ValidateInternRequestAsync(InternRequest request, ApplicationDbContext dbContext)
{
    if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
    {
        return new ApiError("VALIDATION_ERROR", "Vorname und Nachname sind erforderlich.");
    }

    var internships = request.Internships.OrderBy(internship => internship.StartDate).ToList();
    var teamIds = internships
        .SelectMany(internship => internship.Assignments)
        .Select(assignment => assignment.TeamId)
        .Distinct()
        .ToArray();

    if (teamIds.Length > 0)
    {
        var knownTeamIds = await dbContext.Teams
            .Where(team => teamIds.Contains(team.Id))
            .Select(team => team.Id)
            .ToListAsync();

        if (knownTeamIds.Count != teamIds.Length)
        {
            return new ApiError("VALIDATION_ERROR", "Mindestens ein ausgewaehltes Team existiert nicht mehr.");
        }
    }

    for (var internshipIndex = 0; internshipIndex < internships.Count; internshipIndex++)
    {
        var internship = internships[internshipIndex];

        if (internship.StartDate > internship.EndDate)
        {
            return new ApiError("VALIDATION_ERROR", "Ein Praktikumszeitraum hat ein ungueltiges Enddatum.");
        }

        if (internshipIndex > 0 && internships[internshipIndex - 1].EndDate >= internship.StartDate)
        {
            return new ApiError("VALIDATION_ERROR", "Praktikumszeitraeume duerfen sich nicht ueberschneiden.");
        }

        if (internship.Assignments.Count == 0)
        {
            return new ApiError("VALIDATION_ERROR", "Jeder Praktikumszeitraum muss mindestens eine Teamzuweisung enthalten.");
        }

        var assignments = internship.Assignments.OrderBy(assignment => assignment.StartDate).ToList();
        if (assignments[0].StartDate != internship.StartDate || assignments[^1].EndDate != internship.EndDate)
        {
            return new ApiError("VALIDATION_ERROR", "Die Teamzuweisungen muessen den gesamten Praktikumszeitraum lueckenlos abdecken.");
        }

        for (var assignmentIndex = 0; assignmentIndex < assignments.Count; assignmentIndex++)
        {
            var assignment = assignments[assignmentIndex];

            if (assignment.StartDate > assignment.EndDate)
            {
                return new ApiError("VALIDATION_ERROR", "Eine Teamzuweisung hat ein ungueltiges Enddatum.");
            }

            if (assignment.StartDate < internship.StartDate || assignment.EndDate > internship.EndDate)
            {
                return new ApiError("VALIDATION_ERROR", "Alle Teamzuweisungen muessen innerhalb des Praktikumszeitraums liegen.");
            }

            if (assignmentIndex > 0)
            {
                var previous = assignments[assignmentIndex - 1];
                if (previous.EndDate.AddDays(1) != assignment.StartDate)
                {
                    return new ApiError("VALIDATION_ERROR", "Die Teamzuweisungen muessen den Praktikumszeitraum ohne Luecken oder Ueberschneidungen abdecken.");
                }
            }
        }
    }

    return null;
}

static string NormalizeKey(string value) => value.Trim().ToUpperInvariant();

static string NormalizeColor(string? colorHex) => string.IsNullOrWhiteSpace(colorHex) ? "#2563EB" : colorHex.ToUpperInvariant();

static bool CanAccessTeams(ClaimsPrincipal principal) =>
    principal.IsAdministrator()
    || principal.HasPermission(PermissionCatalog.TeamsView)
    || principal.HasPermission(PermissionCatalog.TeamsManage)
    || principal.HasPermission(PermissionCatalog.InternsView)
    || principal.HasPermission(PermissionCatalog.InternsManage);

static class Policies
{
    public const string AdminOnly = "admin.only";
}

static class MappingExtensions
{
    public static UserResponse ToResponse(this UserAccount user) =>
        new(
            user.Id,
            user.UserName,
            user.IsAdministrator,
            user.IsActive,
            user.Permissions.Select(permission => permission.Permission).Order().ToList(),
            NormalizeThemePreference(user.ThemePreference));

    public static TeamResponse ToResponse(this Team team) =>
        new(team.Id, team.Name, team.Description, team.ColorHex, team.IsArchived);

    public static TeamDetailResponse ToDetailResponse(this Team team) =>
        new(
            team.Id,
            team.Name,
            team.Description,
            team.ColorHex,
            team.IsArchived,
            team.Assignments
                .OrderBy(assignment => assignment.StartDate)
                .ThenBy(assignment => assignment.Internship.Intern.LastName)
                .ThenBy(assignment => assignment.Internship.Intern.FirstName)
                .Select(assignment => new TeamAssignmentSummaryResponse(
                    assignment.Id,
                    assignment.InternshipId,
                    assignment.Internship.InternId,
                    assignment.Internship.Intern.FullName,
                    assignment.StartDate,
                    assignment.EndDate))
                .ToList());

    public static InternResponse ToResponse(this Intern intern) =>
        new(
            intern.Id,
            intern.FirstName,
            intern.LastName,
            intern.FullName,
            intern.School,
            intern.Notes,
            intern.Internships
                .OrderBy(internship => internship.StartDate)
                .Select(internship => new InternshipResponse(
                    internship.Id,
                    internship.StartDate,
                    internship.EndDate,
                    internship.Note,
                    internship.Assignments
                        .OrderBy(assignment => assignment.StartDate)
                        .Select(assignment => new AssignmentResponse(
                            assignment.Id,
                            assignment.TeamId,
                            assignment.Team.Name,
                            assignment.Team.ColorHex,
                            assignment.StartDate,
                            assignment.EndDate))
                        .ToList()))
                .ToList());

    public static Intern ToEntity(this InternRequest request) =>
        new()
        {
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            School = request.School?.Trim(),
            Notes = request.Notes?.Trim(),
            Internships = request.Internships
                .OrderBy(internship => internship.StartDate)
                .Select(internship => new Internship
                {
                    StartDate = internship.StartDate,
                    EndDate = internship.EndDate,
                    Note = internship.Note?.Trim(),
                    Assignments = internship.Assignments
                        .OrderBy(assignment => assignment.StartDate)
                        .Select(assignment => new InternshipAssignment
                        {
                            TeamId = assignment.TeamId,
                            StartDate = assignment.StartDate,
                            EndDate = assignment.EndDate
                        })
                        .ToList()
                })
                .ToList()
        };

    private static string NormalizeThemePreference(string? value) =>
        UserAccount.IsValidThemePreference(value ?? string.Empty)
            ? value!
            : UserAccount.ThemeSystem;
}

using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Security;
using WelpenWache.Api.Services;

namespace WelpenWache.Api.Infrastructure;

internal static class AppVersionResolver
{
    public static string ResolveApplicationVersion()
    {
        var informationalVersion = ThisAssembly.AssemblyInformationalVersion;
        var commitId = ThisAssembly.GitCommitId;

        if (!string.IsNullOrWhiteSpace(informationalVersion))
        {
            return FormatApplicationVersion(informationalVersion, commitId);
        }

        var entryAssembly = Assembly.GetEntryAssembly();
        var assemblyVersion = entryAssembly?.GetName().Version?.ToString();
        var version = string.IsNullOrWhiteSpace(assemblyVersion) ? "0.1.0-local" : assemblyVersion;
        return FormatApplicationVersion(version, commitId);
    }

    private static string FormatApplicationVersion(string version, string? commitId)
    {
        var normalizedVersion = version.Split('+', 2)[0];
        var shortCommitId = string.IsNullOrWhiteSpace(commitId)
            ? null
            : commitId[..Math.Min(7, commitId.Length)];

        return string.IsNullOrWhiteSpace(shortCommitId)
            ? normalizedVersion
            : $"{normalizedVersion}+{shortCommitId}";
    }
}

internal static class FrontendIndexResponder
{
    public static async Task ServeFrontendIndexAsync(HttpContext context, IWebHostEnvironment environment)
    {
        var indexFile = Path.Combine(environment.WebRootPath ?? string.Empty, "index.html");
        if (!File.Exists(indexFile))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            await context.Response.WriteAsJsonAsync(new ApiError(
                "FRONTEND_NOT_PUBLISHED",
                "Die eingebettete Frontend-Anwendung wurde nicht gefunden."));
            return;
        }

        var basePath = context.Request.PathBase.HasValue
            ? $"{context.Request.PathBase.Value!.TrimEnd('/')}/"
            : "/";

        var html = await File.ReadAllTextAsync(indexFile);
        html = html.Replace("<base href=\"/\" />", $"<base href=\"{basePath}\" />");

        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.WriteAsync(html);
    }
}

internal static class ApiValidation
{
    public static string? ValidatePermissions(IEnumerable<string> permissions)
    {
        return permissions.Except(PermissionCatalog.All, StringComparer.OrdinalIgnoreCase).Any()
            ? "Mindestens eine Berechtigung ist ungueltig."
            : null;
    }

    public static async Task<ApiError?> ValidateTeamAsync(TeamRequest request, ApplicationDbContext dbContext, Guid? currentTeamId)
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

        var supervisors = request.Supervisors ?? [];
        var normalizedSupervisorNames = new HashSet<string>(StringComparer.Ordinal);
        var supervisorIds = new HashSet<Guid>();

        foreach (var supervisor in supervisors)
        {
            if (string.IsNullOrWhiteSpace(supervisor.Name))
            {
                return new ApiError("VALIDATION_ERROR", "Jeder Betreuer benoetigt einen Namen.");
            }

            var normalizedSupervisorName = NormalizeKey(supervisor.Name);
            if (!normalizedSupervisorNames.Add(normalizedSupervisorName))
            {
                return new ApiError("VALIDATION_ERROR", "Betreuer innerhalb eines Teams muessen eindeutige Namen haben.");
            }

            if (supervisor.Id is Guid supervisorId)
            {
                if (supervisorId == Guid.Empty || !supervisorIds.Add(supervisorId))
                {
                    return new ApiError("VALIDATION_ERROR", "Die Betreuerdaten enthalten ungueltige oder doppelte IDs.");
                }
            }
        }

        if (currentTeamId is Guid teamId)
        {
            if (supervisorIds.Count > 0)
            {
                var knownSupervisorIds = await dbContext.Supervisors
                    .Where(supervisor => supervisor.TeamId == teamId && supervisorIds.Contains(supervisor.Id))
                    .Select(supervisor => supervisor.Id)
                    .ToListAsync();

                if (knownSupervisorIds.Count != supervisorIds.Count)
                {
                    return new ApiError("VALIDATION_ERROR", "Mindestens ein Betreuer gehoert nicht zu diesem Team.");
                }
            }

            var removedSupervisorIds = await dbContext.Supervisors
                .Where(supervisor => supervisor.TeamId == teamId && !supervisorIds.Contains(supervisor.Id))
                .Select(supervisor => supervisor.Id)
                .ToListAsync();

            if (removedSupervisorIds.Count > 0)
            {
                var hasAssignments = await dbContext.Assignments.AnyAsync(assignment =>
                    assignment.SupervisorId.HasValue && removedSupervisorIds.Contains(assignment.SupervisorId.Value));

                if (hasAssignments)
                {
                    return new ApiError("VALIDATION_ERROR", "Betreuer mit bestehenden Zuweisungen koennen nicht entfernt werden.");
                }
            }
        }

        return null;
    }

    public static async Task<ApiError?> ValidateInternRequestAsync(InternRequest request, ApplicationDbContext dbContext)
    {
        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
        {
            return new ApiError("VALIDATION_ERROR", "Vorname und Nachname sind erforderlich.");
        }

        if (!InternGenderCatalog.IsValid(request.Gender))
        {
            return new ApiError("VALIDATION_ERROR", "Das Geschlecht ist ungueltig.");
        }

        var internships = request.Internships.OrderBy(internship => internship.StartDate).ToList();
        var teamIds = internships
            .SelectMany(internship => internship.Assignments)
            .Select(assignment => assignment.TeamId)
            .Distinct()
            .ToArray();
        var supervisorIds = internships
            .SelectMany(internship => internship.Assignments)
            .Where(assignment => assignment.SupervisorId.HasValue)
            .Select(assignment => assignment.SupervisorId!.Value)
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

        Dictionary<Guid, Guid>? supervisorTeamMap = null;
        if (supervisorIds.Length > 0)
        {
            supervisorTeamMap = await dbContext.Supervisors
                .Where(supervisor => supervisorIds.Contains(supervisor.Id))
                .ToDictionaryAsync(supervisor => supervisor.Id, supervisor => supervisor.TeamId);

            if (supervisorTeamMap.Count != supervisorIds.Length)
            {
                return new ApiError("VALIDATION_ERROR", "Mindestens ein ausgewaehlter Betreuer existiert nicht mehr.");
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

            var assignments = internship.Assignments.OrderBy(assignment => assignment.StartDate).ToList();
            if (assignments.Count == 0)
            {
                if (ContainsWeekday(internship.StartDate, internship.EndDate))
                {
                    return new ApiError("VALIDATION_ERROR", "Alle Werktage im Praktikumszeitraum muessen durch Teamzuweisungen abgedeckt sein.");
                }

                continue;
            }

            for (var assignmentIndex = 0; assignmentIndex < assignments.Count; assignmentIndex++)
            {
                var assignment = assignments[assignmentIndex];

                if (assignment.StartDate > assignment.EndDate)
                {
                    return new ApiError("VALIDATION_ERROR", "Eine Teamzuweisung hat ein ungueltiges Enddatum.");
                }

                if (assignment.SupervisorId is null || assignment.SupervisorId == Guid.Empty)
                {
                    return new ApiError("VALIDATION_ERROR", "Jede Teamzuweisung benoetigt genau einen Betreuer.");
                }

                if (supervisorTeamMap is not null && supervisorTeamMap.GetValueOrDefault(assignment.SupervisorId.Value) != assignment.TeamId)
                {
                    return new ApiError("VALIDATION_ERROR", "Der ausgewaehlte Betreuer muss zum zugewiesenen Team gehoeren.");
                }

                if (assignment.StartDate < internship.StartDate || assignment.EndDate > internship.EndDate)
                {
                    return new ApiError("VALIDATION_ERROR", "Alle Teamzuweisungen muessen innerhalb des Praktikumszeitraums liegen.");
                }

                if (assignmentIndex > 0)
                {
                    var previous = assignments[assignmentIndex - 1];
                    if (previous.EndDate >= assignment.StartDate)
                    {
                        return new ApiError("VALIDATION_ERROR", "Die Teamzuweisungen duerfen sich nicht ueberschneiden.");
                    }
                }
            }

            if (!WeekdaysAreFullyCovered(internship.StartDate, internship.EndDate, assignments))
            {
                return new ApiError("VALIDATION_ERROR", "Alle Werktage im Praktikumszeitraum muessen durch Teamzuweisungen abgedeckt sein.");
            }
        }

        return null;
    }

    private static bool WeekdaysAreFullyCovered(DateOnly startDate, DateOnly endDate, IReadOnlyList<AssignmentRequest> assignments)
    {
        var cursor = startDate;

        foreach (var assignment in assignments)
        {
            if (ContainsWeekday(cursor, assignment.StartDate.AddDays(-1)))
            {
                return false;
            }

            cursor = assignment.EndDate.AddDays(1);
        }

        return !ContainsWeekday(cursor, endDate);
    }

    private static bool ContainsWeekday(DateOnly startDate, DateOnly endDate)
    {
        if (startDate > endDate)
        {
            return false;
        }

        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            if (date.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
            {
                return true;
            }
        }

        return false;
    }

    public static string NormalizeKey(string value) => value.Trim().ToUpperInvariant();

    public static string NormalizeColor(string? colorHex) =>
        string.IsNullOrWhiteSpace(colorHex) ? "#2563EB" : colorHex.ToUpperInvariant();

    public static string NormalizeTemplatePurpose(string value)
    {
        var normalizedValue = DocumentTemplatePurposeCatalog.Normalize(value);
        if (!DocumentTemplatePurposeCatalog.IsValid(normalizedValue))
        {
            throw new InvalidOperationException("Der Vorlagenzweck ist ungueltig.");
        }

        return normalizedValue;
    }

    public static string NormalizeTemplateLanguage(string value)
    {
        var normalizedValue = value.Trim().ToLowerInvariant();
        if (!UserAccount.IsValidLanguagePreference(normalizedValue))
        {
            throw new InvalidOperationException("Die Vorlagensprache ist ungueltig.");
        }

        return normalizedValue;
    }

    public static ApiError? ValidateDocumentTemplateForm(DocumentTemplateUpsertForm form, bool fileRequired)
    {
        if (string.IsNullOrWhiteSpace(form.Name))
        {
            return new ApiError("VALIDATION_ERROR", "Der Name der Vorlage ist erforderlich.");
        }

        try
        {
            NormalizeTemplatePurpose(form.Purpose);
            NormalizeTemplateLanguage(form.Language);
        }
        catch (InvalidOperationException exception)
        {
            return new ApiError("VALIDATION_ERROR", exception.Message);
        }

        if (fileRequired)
        {
            try
            {
                TemplateStorageService.ValidateTemplateFile(form.File);
            }
            catch (InvalidOperationException exception)
            {
                return new ApiError("VALIDATION_ERROR", exception.Message);
            }
        }

        if (form.File is not null)
        {
            try
            {
                TemplateStorageService.ValidateTemplateFile(form.File);
            }
            catch (InvalidOperationException exception)
            {
                return new ApiError("VALIDATION_ERROR", exception.Message);
            }
        }

        return null;
    }

    public static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> ToConfiguredValueMap(
        IReadOnlyDictionary<string, Dictionary<string, string>> source) =>
        source.ToDictionary(
            item => item.Key,
            item => (IReadOnlyDictionary<string, string>)item.Value.ToDictionary(
                language => language.Key,
                language => language.Value ?? string.Empty,
                StringComparer.OrdinalIgnoreCase),
            StringComparer.OrdinalIgnoreCase);

    public static void SyncSupervisors(
        ApplicationDbContext dbContext,
        Guid teamId,
        IReadOnlyCollection<Supervisor> existingSupervisors,
        IReadOnlyList<SupervisorUpsertRequest> supervisors)
    {
        var existingById = existingSupervisors.ToDictionary(supervisor => supervisor.Id);
        var requestedIds = supervisors
            .Where(supervisor => supervisor.Id.HasValue)
            .Select(supervisor => supervisor.Id!.Value)
            .ToHashSet();

        foreach (var supervisorRequest in supervisors)
        {
            if (supervisorRequest.Id is Guid supervisorId && existingById.TryGetValue(supervisorId, out var existingSupervisor))
            {
                existingSupervisor.Name = supervisorRequest.Name.Trim();
                existingSupervisor.NormalizedName = NormalizeKey(supervisorRequest.Name);
                existingSupervisor.Notes = supervisorRequest.Notes?.Trim();
                continue;
            }

            var supervisor = new Supervisor
            {
                TeamId = teamId,
                Name = supervisorRequest.Name.Trim(),
                NormalizedName = NormalizeKey(supervisorRequest.Name),
                Notes = supervisorRequest.Notes?.Trim()
            };

            dbContext.Supervisors.Add(supervisor);
        }

        var supervisorsToRemove = existingSupervisors
            .Where(supervisor => !requestedIds.Contains(supervisor.Id))
            .ToList();

        if (supervisorsToRemove.Count > 0)
        {
            dbContext.Supervisors.RemoveRange(supervisorsToRemove);
        }
    }
}

internal static class ApiAccess
{
    public static bool CanAccessTeams(ClaimsPrincipal principal) =>
        principal.IsAdministrator()
        || principal.HasPermission(PermissionCatalog.TeamsView)
        || principal.HasPermission(PermissionCatalog.TeamsManage)
        || principal.HasPermission(PermissionCatalog.InternsView)
        || principal.HasPermission(PermissionCatalog.InternsManage);

    public static bool CanAccessInterns(ClaimsPrincipal principal) =>
        principal.IsAdministrator()
        || principal.HasPermission(PermissionCatalog.InternsView)
        || principal.HasPermission(PermissionCatalog.InternsManage)
        || principal.HasPermission(PermissionCatalog.DocumentsView)
        || principal.HasPermission(PermissionCatalog.DocumentsManage);

    public static bool CanAccessDocuments(ClaimsPrincipal principal) =>
        principal.IsAdministrator()
        || principal.HasPermission(PermissionCatalog.DocumentsView)
        || principal.HasPermission(PermissionCatalog.DocumentsManage);
}

internal static class MappingExtensions
{
    public static UserResponse ToResponse(this UserAccount user) =>
        new(
            user.Id,
            user.UserName,
            user.IsAdministrator,
            user.IsActive,
            user.Permissions.Select(permission => permission.Permission).Order().ToList(),
            NormalizeLanguagePreference(user.LanguagePreference),
            NormalizeThemePreference(user.ThemePreference));

    public static TeamResponse ToResponse(this Team team) =>
        new(
            team.Id,
            team.Name,
            team.Description,
            team.ColorHex,
            team.IsArchived,
            team.Supervisors
                .OrderBy(supervisor => supervisor.Name)
                .Select(supervisor => supervisor.ToResponse())
                .ToList());

    public static TeamDetailResponse ToDetailResponse(this Team team) =>
        new(
            team.Id,
            team.Name,
            team.Description,
            team.ColorHex,
            team.IsArchived,
            team.Supervisors
                .OrderBy(supervisor => supervisor.Name)
                .Select(supervisor => supervisor.ToResponse())
                .ToList(),
            team.Assignments
                .OrderBy(assignment => assignment.StartDate)
                .ThenBy(assignment => assignment.Internship.Intern.LastName)
                .ThenBy(assignment => assignment.Internship.Intern.FirstName)
                .Select(assignment => new TeamAssignmentSummaryResponse(
                    assignment.Id,
                    assignment.InternshipId,
                    assignment.Internship.InternId,
                    assignment.Internship.Intern.FullName,
                    assignment.SupervisorId,
                    assignment.Supervisor?.Name,
                    assignment.StartDate,
                    assignment.EndDate))
                .ToList());

    public static InternResponse ToResponse(this Intern intern) =>
        new(
            intern.Id,
            intern.FirstName,
            intern.LastName,
            intern.FullName,
            InternGenderCatalog.Normalize(intern.Gender),
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
                            assignment.SupervisorId,
                            assignment.Supervisor?.Name,
                            assignment.StartDate,
                            assignment.EndDate))
                        .ToList()))
                .ToList());

    public static Intern ToEntity(this InternRequest request) =>
        new()
        {
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Gender = InternGenderCatalog.Normalize(request.Gender),
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
                            SupervisorId = assignment.SupervisorId,
                            StartDate = assignment.StartDate,
                            EndDate = assignment.EndDate
                        })
                        .ToList()
                })
                .ToList()
        };

    public static SupervisorResponse ToResponse(this Supervisor supervisor) =>
        new(supervisor.Id, supervisor.TeamId, supervisor.Name, supervisor.Notes);

    public static DocumentTemplateResponse ToResponse(this DocumentTemplate template) =>
        new(
            template.Id,
            template.Name,
            template.Purpose,
            NormalizeLanguagePreference(template.Language),
            template.RelativeFilePath,
            template.OriginalFileName,
            template.IsActive,
            template.UploadedUtc);

    private static string NormalizeThemePreference(string? value) =>
        UserAccount.IsValidThemePreference(value ?? string.Empty)
            ? value!
            : UserAccount.ThemeSystem;

    private static string NormalizeLanguagePreference(string? value) =>
        UserAccount.IsValidLanguagePreference(value ?? string.Empty)
            ? value!
            : UserAccount.LanguageGerman;
}

internal static class Policies
{
    public const string AdminOnly = "admin.only";
}

internal sealed class DocumentTemplateUpsertForm
{
    public string Name { get; init; } = string.Empty;

    public string Purpose { get; init; } = string.Empty;

    public string Language { get; init; } = UserAccount.LanguageGerman;

    public bool IsActive { get; init; } = true;

    public IFormFile? File { get; init; }
}

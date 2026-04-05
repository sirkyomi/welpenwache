namespace WelpenWache.Api.Contracts;

public sealed record ApiError(string Code, string Message);

public sealed record SetupStatusResponse(bool RequiresSetup);

public sealed record SetupAdminRequest(string UserName, string Password);

public sealed record LoginRequest(string UserName, string Password);

public sealed record AuthResponse(
    string Token,
    DateTime ExpiresAtUtc,
    UserResponse User);

public sealed record AppVersionResponse(string Version);

public sealed record UserResponse(
    Guid Id,
    string UserName,
    bool IsAdministrator,
    bool IsActive,
    IReadOnlyList<string> Permissions,
    string ThemePreference);

public sealed record CreateUserRequest(
    string UserName,
    string Password,
    bool IsAdministrator,
    bool IsActive,
    IReadOnlyList<string> Permissions);

public sealed record UpdateUserRequest(
    string UserName,
    bool IsAdministrator,
    bool IsActive,
    string? NewPassword,
    IReadOnlyList<string> Permissions);

public sealed record UpdateThemePreferenceRequest(string ThemePreference);

public sealed record TeamRequest(
    string Name,
    string? Description,
    string? ColorHex,
    bool IsArchived,
    IReadOnlyList<SupervisorUpsertRequest>? Supervisors);

public sealed record SupervisorUpsertRequest(
    Guid? Id,
    string Name,
    string? Notes);

public sealed record SupervisorResponse(
    Guid Id,
    Guid TeamId,
    string Name,
    string? Notes);

public sealed record TeamResponse(
    Guid Id,
    string Name,
    string? Description,
    string ColorHex,
    bool IsArchived,
    IReadOnlyList<SupervisorResponse> Supervisors);

public sealed record TeamAssignmentSummaryResponse(
    Guid AssignmentId,
    Guid InternshipId,
    Guid InternId,
    string InternName,
    Guid? SupervisorId,
    string? SupervisorName,
    DateOnly StartDate,
    DateOnly EndDate);

public sealed record TeamDetailResponse(
    Guid Id,
    string Name,
    string? Description,
    string ColorHex,
    bool IsArchived,
    IReadOnlyList<SupervisorResponse> Supervisors,
    IReadOnlyList<TeamAssignmentSummaryResponse> Assignments);

public sealed record AssignmentRequest(
    Guid TeamId,
    Guid? SupervisorId,
    DateOnly StartDate,
    DateOnly EndDate);

public sealed record InternshipRequest(
    DateOnly StartDate,
    DateOnly EndDate,
    string? Note,
    IReadOnlyList<AssignmentRequest> Assignments);

public sealed record InternRequest(
    string FirstName,
    string LastName,
    string? School,
    string? Notes,
    IReadOnlyList<InternshipRequest> Internships);

public sealed record AssignmentResponse(
    Guid Id,
    Guid TeamId,
    string TeamName,
    string TeamColorHex,
    Guid? SupervisorId,
    string? SupervisorName,
    DateOnly StartDate,
    DateOnly EndDate);

public sealed record InternshipResponse(
    Guid Id,
    DateOnly StartDate,
    DateOnly EndDate,
    string? Note,
    IReadOnlyList<AssignmentResponse> Assignments);

public sealed record InternResponse(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName,
    string? School,
    string? Notes,
    IReadOnlyList<InternshipResponse> Internships);

public sealed record CalendarDayEntryResponse(
    Guid InternId,
    string InternName,
    Guid InternshipId,
    Guid TeamId,
    string TeamName,
    string TeamColorHex);

public sealed record CalendarDayResponse(
    DateOnly Date,
    IReadOnlyList<CalendarDayEntryResponse> Entries);

public sealed record CalendarMonthResponse(
    int Year,
    int Month,
    IReadOnlyList<CalendarDayResponse> Days);

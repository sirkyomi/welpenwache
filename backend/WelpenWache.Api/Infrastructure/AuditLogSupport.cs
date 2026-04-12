using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Domain;
using WelpenWache.Api.Security;

namespace WelpenWache.Api.Infrastructure;

internal static class AuditLogActions
{
    public const string Create = "create";
    public const string Update = "update";
    public const string Delete = "delete";

    public static bool IsValid(string? value) =>
        value is Create or Update or Delete;

    public static string Normalize(string value) => value.Trim().ToLowerInvariant();
}

internal sealed record AuditedEntitySnapshot(
    string EntityType,
    Guid EntityId,
    string EntityLabel,
    JsonNode? Data);

internal sealed record AuditDiffEntry(
    string Path,
    string ChangeType,
    JsonNode? OldValue,
    JsonNode? NewValue);

internal static class AuditLogFactory
{
    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web);

    public static AuditedEntitySnapshot CaptureSnapshot(object entity) =>
        entity switch
        {
            UserAccount user => new AuditedEntitySnapshot("user", user.Id, user.UserName, BuildUserData(user)),
            Team team => new AuditedEntitySnapshot("team", team.Id, team.Name, BuildTeamData(team)),
            Intern intern => new AuditedEntitySnapshot("intern", intern.Id, intern.FullName, BuildInternData(intern)),
            InternshipTemplate template => new AuditedEntitySnapshot("internshipTemplate", template.Id, template.Name, BuildInternshipTemplateData(template)),
            DocumentTemplate template => new AuditedEntitySnapshot("documentTemplate", template.Id, template.Name, BuildDocumentTemplateData(template)),
            _ => throw new InvalidOperationException($"Entity type '{entity.GetType().Name}' is not configured for audit logging.")
        };

    public static AuditLog? Create(
        ClaimsPrincipal? actor,
        string action,
        AuditedEntitySnapshot? beforeSnapshot,
        AuditedEntitySnapshot? afterSnapshot)
    {
        if (beforeSnapshot is null && afterSnapshot is null)
        {
            throw new InvalidOperationException("An audit log requires at least one entity snapshot.");
        }

        var normalizedAction = AuditLogActions.Normalize(action);
        if (!AuditLogActions.IsValid(normalizedAction))
        {
            throw new InvalidOperationException($"Audit action '{action}' is not supported.");
        }

        var subject = afterSnapshot ?? beforeSnapshot!;
        if (beforeSnapshot is not null
            && afterSnapshot is not null
            && !string.Equals(beforeSnapshot.EntityType, afterSnapshot.EntityType, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Audit snapshots must belong to the same entity type.");
        }

        var changes = AuditDiffBuilder.Build(beforeSnapshot?.Data, afterSnapshot?.Data);
        if (normalizedAction == AuditLogActions.Update && changes.Count == 0)
        {
            return null;
        }

        return new AuditLog
        {
            EntityType = subject.EntityType,
            EntityId = subject.EntityId,
            EntityLabel = subject.EntityLabel,
            Action = normalizedAction,
            ActorUserId = actor?.GetUserId() is { } actorUserId && actorUserId != Guid.Empty ? actorUserId : null,
            ActorUserName = actor?.GetUserName(),
            OccurredUtc = DateTime.UtcNow,
            ChangeCount = changes.Count,
            BeforeJson = SerializeNode(beforeSnapshot?.Data),
            AfterJson = SerializeNode(afterSnapshot?.Data),
            ChangesJson = JsonSerializer.Serialize(changes, JsonSerializerOptions)
        };
    }

    public static AuditLog? Create(
        ClaimsPrincipal? actor,
        string action,
        AuditedEntitySnapshot? beforeSnapshot,
        object? afterEntity) =>
        Create(actor, action, beforeSnapshot, afterEntity is null ? null : CaptureSnapshot(afterEntity));

    private static JsonObject BuildUserData(UserAccount user) =>
        new()
        {
            ["userName"] = user.UserName,
            ["isAdministrator"] = user.IsAdministrator,
            ["isActive"] = user.IsActive,
            ["languagePreference"] = user.LanguagePreference,
            ["themePreference"] = user.ThemePreference,
            ["permissions"] = ToJsonArray(user.Permissions
                .Select(permission => permission.Permission)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Order(StringComparer.OrdinalIgnoreCase)
                .Select(permission => (JsonNode?)JsonValue.Create(permission)))
        };

    private static JsonObject BuildTeamData(Team team) =>
        new()
        {
            ["name"] = team.Name,
            ["description"] = team.Description,
            ["colorHex"] = team.ColorHex,
            ["isArchived"] = team.IsArchived,
            ["supervisors"] = ToJsonArray(team.Supervisors
                .OrderBy(supervisor => supervisor.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(supervisor => supervisor.Notes, StringComparer.OrdinalIgnoreCase)
                .Select(supervisor => (JsonNode?)new JsonObject
                {
                    ["name"] = supervisor.Name,
                    ["notes"] = supervisor.Notes
                }))
        };

    private static JsonObject BuildInternData(Intern intern) =>
        new()
        {
            ["firstName"] = intern.FirstName,
            ["lastName"] = intern.LastName,
            ["fullName"] = intern.FullName,
            ["gender"] = intern.Gender,
            ["school"] = intern.School,
            ["notes"] = intern.Notes,
            ["internships"] = ToJsonArray(intern.Internships
                .OrderBy(internship => internship.StartDate)
                .ThenBy(internship => internship.EndDate)
                .Select(internship => (JsonNode?)new JsonObject
                {
                    ["startDate"] = internship.StartDate.ToString("yyyy-MM-dd"),
                    ["endDate"] = internship.EndDate.ToString("yyyy-MM-dd"),
                    ["note"] = internship.Note,
                    ["assignments"] = ToJsonArray(internship.Assignments
                        .OrderBy(assignment => assignment.StartDate)
                        .ThenBy(assignment => assignment.EndDate)
                        .ThenBy(assignment => assignment.TeamId)
                        .ThenBy(assignment => assignment.SupervisorId)
                        .Select(assignment => (JsonNode?)new JsonObject
                        {
                            ["teamId"] = assignment.TeamId,
                            ["teamName"] = assignment.Team?.Name,
                            ["supervisorId"] = assignment.SupervisorId,
                            ["supervisorName"] = assignment.Supervisor?.Name,
                            ["startDate"] = assignment.StartDate.ToString("yyyy-MM-dd"),
                            ["endDate"] = assignment.EndDate.ToString("yyyy-MM-dd")
                        }))
                }))
        };

    private static JsonObject BuildDocumentTemplateData(DocumentTemplate template) =>
        new()
        {
            ["name"] = template.Name,
            ["purpose"] = template.Purpose,
            ["language"] = template.Language,
            ["relativeFilePath"] = template.RelativeFilePath,
            ["originalFileName"] = template.OriginalFileName,
            ["isActive"] = template.IsActive,
            ["uploadedUtc"] = template.UploadedUtc.ToString("O")
        };

    private static JsonObject BuildInternshipTemplateData(InternshipTemplate template) =>
        new()
        {
            ["name"] = template.Name,
            ["description"] = template.Description,
            ["isActive"] = template.IsActive,
            ["assignments"] = ToJsonArray(template.Assignments
                .OrderBy(assignment => assignment.SortOrder)
                .ThenBy(assignment => assignment.StartOffsetDays)
                .ThenBy(assignment => assignment.EndOffsetDays)
                .Select(assignment => (JsonNode?)new JsonObject
                {
                    ["teamId"] = assignment.TeamId,
                    ["teamName"] = assignment.Team?.Name,
                    ["supervisorId"] = assignment.SupervisorId,
                    ["supervisorName"] = assignment.Supervisor?.Name,
                    ["startOffsetDays"] = assignment.StartOffsetDays,
                    ["endOffsetDays"] = assignment.EndOffsetDays,
                    ["sortOrder"] = assignment.SortOrder
                }))
        };

    private static JsonArray ToJsonArray(IEnumerable<JsonNode?> nodes)
    {
        var array = new JsonArray();
        foreach (var node in nodes)
        {
            array.Add(node);
        }

        return array;
    }

    private static string? SerializeNode(JsonNode? node) =>
        node?.ToJsonString(JsonSerializerOptions);
}

internal static class AuditDiffBuilder
{
    public static IReadOnlyList<AuditDiffEntry> Build(JsonNode? before, JsonNode? after)
    {
        var changes = new List<AuditDiffEntry>();
        Compare(before, after, string.Empty, changes);
        return changes;
    }

    private static void Compare(JsonNode? before, JsonNode? after, string path, ICollection<AuditDiffEntry> changes)
    {
        if (before is null && after is null)
        {
            return;
        }

        if (before is null)
        {
            changes.Add(new AuditDiffEntry(path.Length == 0 ? "$" : path, "added", null, after?.DeepClone()));
            return;
        }

        if (after is null)
        {
            changes.Add(new AuditDiffEntry(path.Length == 0 ? "$" : path, "removed", before.DeepClone(), null));
            return;
        }

        if (before is JsonObject beforeObject && after is JsonObject afterObject)
        {
            var propertyNames = beforeObject
                .Select(property => property.Key)
                .Union(afterObject.Select(property => property.Key), StringComparer.Ordinal)
                .Order(StringComparer.Ordinal)
                .ToList();

            foreach (var propertyName in propertyNames)
            {
                Compare(
                    beforeObject[propertyName],
                    afterObject[propertyName],
                    path.Length == 0 ? propertyName : $"{path}.{propertyName}",
                    changes);
            }

            return;
        }

        if (before is JsonArray beforeArray && after is JsonArray afterArray)
        {
            var length = Math.Max(beforeArray.Count, afterArray.Count);
            for (var index = 0; index < length; index++)
            {
                Compare(
                    index < beforeArray.Count ? beforeArray[index] : null,
                    index < afterArray.Count ? afterArray[index] : null,
                    $"{path}[{index}]",
                    changes);
            }

            return;
        }

        if (JsonNode.DeepEquals(before, after))
        {
            return;
        }

        changes.Add(new AuditDiffEntry(path.Length == 0 ? "$" : path, "modified", before.DeepClone(), after.DeepClone()));
    }
}

internal static class AuditLogMappingExtensions
{
    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web);

    public static AuditLogListItemResponse ToListItemResponse(this AuditLog auditLog) =>
        new(
            auditLog.Id,
            auditLog.EntityType,
            auditLog.EntityId,
            auditLog.EntityLabel,
            auditLog.Action,
            auditLog.OccurredUtc,
            auditLog.ActorUserId,
            auditLog.ActorUserName,
            auditLog.ChangeCount);

    public static AuditLogDetailResponse ToDetailResponse(this AuditLog auditLog) =>
        new(
            auditLog.Id,
            auditLog.EntityType,
            auditLog.EntityId,
            auditLog.EntityLabel,
            auditLog.Action,
            auditLog.OccurredUtc,
            auditLog.ActorUserId,
            auditLog.ActorUserName,
            auditLog.ChangeCount,
            ParseNode(auditLog.BeforeJson),
            ParseNode(auditLog.AfterJson),
            JsonSerializer.Deserialize<IReadOnlyList<AuditLogChangeResponse>>(auditLog.ChangesJson, JsonSerializerOptions)
            ?? []);

    private static JsonNode? ParseNode(string? json) =>
        string.IsNullOrWhiteSpace(json)
            ? null
            : JsonNode.Parse(json);
}

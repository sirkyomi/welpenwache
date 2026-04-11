namespace WelpenWache.Api.Domain;

public sealed class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string EntityType { get; set; } = string.Empty;

    public Guid EntityId { get; set; }

    public string EntityLabel { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public Guid? ActorUserId { get; set; }

    public string? ActorUserName { get; set; }

    public DateTime OccurredUtc { get; set; } = DateTime.UtcNow;

    public int ChangeCount { get; set; }

    public string? BeforeJson { get; set; }

    public string? AfterJson { get; set; }

    public string ChangesJson { get; set; } = "[]";
}

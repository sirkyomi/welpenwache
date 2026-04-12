namespace WelpenWache.Api.Domain;

public sealed class InternshipTemplateAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid InternshipTemplateId { get; set; }

    public Guid TeamId { get; set; }

    public Guid? SupervisorId { get; set; }

    public int StartOffsetDays { get; set; }

    public int EndOffsetDays { get; set; }

    public int SortOrder { get; set; }

    public InternshipTemplate InternshipTemplate { get; set; } = null!;

    public Team Team { get; set; } = null!;

    public Supervisor? Supervisor { get; set; }
}

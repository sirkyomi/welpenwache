namespace WelpenWache.Api.Domain;

public sealed class Supervisor
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TeamId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string NormalizedName { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public Team Team { get; set; } = null!;

    public List<InternshipAssignment> Assignments { get; set; } = [];

    public List<InternshipTemplateAssignment> InternshipTemplateAssignments { get; set; } = [];
}

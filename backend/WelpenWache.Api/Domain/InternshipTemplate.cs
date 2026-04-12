namespace WelpenWache.Api.Domain;

public sealed class InternshipTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public List<InternshipTemplateAssignment> Assignments { get; set; } = [];
}

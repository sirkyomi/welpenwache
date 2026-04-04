namespace WelpenWache.Api.Domain;

public sealed class Team
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public string NormalizedName { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string ColorHex { get; set; } = "#2563EB";

    public bool IsArchived { get; set; }

    public List<InternshipAssignment> Assignments { get; set; } = [];
}

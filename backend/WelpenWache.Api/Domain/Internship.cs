namespace WelpenWache.Api.Domain;

public sealed class Internship
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid InternId { get; set; }

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    public string? Note { get; set; }

    public Intern Intern { get; set; } = null!;

    public List<InternshipAssignment> Assignments { get; set; } = [];
}

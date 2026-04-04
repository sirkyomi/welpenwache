namespace WelpenWache.Api.Domain;

public sealed class InternshipAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid InternshipId { get; set; }

    public Guid TeamId { get; set; }

    public Guid? SupervisorId { get; set; }

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    public Internship Internship { get; set; } = null!;

    public Team Team { get; set; } = null!;

    public Supervisor? Supervisor { get; set; }
}

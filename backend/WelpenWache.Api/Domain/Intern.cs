namespace WelpenWache.Api.Domain;

public sealed class Intern
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string FirstName { get; set; } = string.Empty;

    public string LastName { get; set; } = string.Empty;

    public string? School { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

    public List<Internship> Internships { get; set; } = [];

    public string FullName => $"{FirstName} {LastName}".Trim();
}

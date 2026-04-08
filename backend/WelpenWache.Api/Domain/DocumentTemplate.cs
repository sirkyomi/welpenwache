namespace WelpenWache.Api.Domain;

public sealed class DocumentTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public string Purpose { get; set; } = DocumentTemplatePurposeCatalog.Completion;

    public string Language { get; set; } = "de";

    public string RelativeFilePath { get; set; } = string.Empty;

    public string OriginalFileName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime UploadedUtc { get; set; } = DateTime.UtcNow;
}

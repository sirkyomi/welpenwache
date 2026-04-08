namespace WelpenWache.Api.Domain;

public static class DocumentTemplatePurposeCatalog
{
    public const string Completion = "completion";

    public static readonly string[] All =
    [
        Completion
    ];

    public static bool IsValid(string value) =>
        All.Contains(value, StringComparer.OrdinalIgnoreCase);

    public static string Normalize(string value) =>
        value.Trim().ToLowerInvariant();
}

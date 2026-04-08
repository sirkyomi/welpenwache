namespace WelpenWache.Api.Services;

public sealed class CompletionDocumentOptions
{
    public Dictionary<string, Dictionary<string, string>> Genders { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);

    public Dictionary<string, Dictionary<string, string>> Salutations { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);
}

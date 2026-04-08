namespace WelpenWache.Api.Domain;

public static class InternGenderCatalog
{
    public const string Male = "male";
    public const string Female = "female";
    public const string Diverse = "diverse";

    public static readonly string[] All =
    [
        Male,
        Female,
        Diverse
    ];

    public static bool IsValid(string value) =>
        All.Contains(value, StringComparer.OrdinalIgnoreCase);

    public static string Normalize(string? value) =>
        IsValid(value ?? string.Empty)
            ? value!.Trim().ToLowerInvariant()
            : Male;
}

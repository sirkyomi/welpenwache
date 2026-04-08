namespace WelpenWache.Api.Domain;

public static class InternGender
{
    public const string Male = InternGenderCatalog.Male;
    public const string Female = InternGenderCatalog.Female;
    public const string Diverse = InternGenderCatalog.Diverse;

    public static string Normalize(string? value) => InternGenderCatalog.Normalize(value);
}

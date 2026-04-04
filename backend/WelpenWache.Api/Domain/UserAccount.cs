namespace WelpenWache.Api.Domain;

public sealed class UserAccount
{
    public const string ThemeSystem = "system";
    public const string ThemeLight = "light";
    public const string ThemeDark = "dark";

    public Guid Id { get; set; } = Guid.NewGuid();

    public string UserName { get; set; } = string.Empty;

    public string NormalizedUserName { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public bool IsAdministrator { get; set; }

    public bool IsActive { get; set; } = true;

    public string ThemePreference { get; set; } = ThemeSystem;

    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

    public List<UserPermission> Permissions { get; set; } = [];

    public static bool IsValidThemePreference(string value)
    {
        return value is ThemeSystem or ThemeLight or ThemeDark;
    }
}

namespace WelpenWache.Api.Domain;

public sealed class UserPermission
{
    public Guid UserAccountId { get; set; }

    public string Permission { get; set; } = string.Empty;

    public UserAccount UserAccount { get; set; } = null!;
}

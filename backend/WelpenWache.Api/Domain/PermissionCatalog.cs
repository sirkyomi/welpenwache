namespace WelpenWache.Api.Domain;

public static class PermissionCatalog
{
    public const string InternsView = "interns.view";
    public const string InternsManage = "interns.manage";
    public const string TeamsView = "teams.view";
    public const string TeamsManage = "teams.manage";

    public static readonly string[] All =
    [
        InternsView,
        InternsManage,
        TeamsView,
        TeamsManage
    ];
}

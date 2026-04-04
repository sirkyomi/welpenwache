using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Domain;

namespace WelpenWache.Api.Security;

public sealed class JwtTokenService(JwtOptions options)
{
    public AuthResponse CreateToken(UserAccount user)
    {
        var now = DateTime.UtcNow;
        var expiresAtUtc = now.AddHours(options.ExpiresInHours);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName),
            new(JwtRegisteredClaimNames.UniqueName, user.UserName)
        };

        if (user.IsAdministrator)
        {
            claims.Add(new Claim(ClaimTypes.Role, "Administrator"));
        }

        claims.AddRange(user.Permissions.Select(permission => new Claim("permission", permission.Permission)));

        var signingCredentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            notBefore: now,
            expires: expiresAtUtc,
            signingCredentials: signingCredentials);

        return new AuthResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            expiresAtUtc,
            new UserResponse(
                user.Id,
                user.UserName,
                user.IsAdministrator,
                user.IsActive,
                user.Permissions.Select(permission => permission.Permission).Order().ToList(),
                user.ThemePreference));
    }
}

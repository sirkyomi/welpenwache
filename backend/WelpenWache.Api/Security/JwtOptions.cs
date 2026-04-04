using System.Security.Cryptography;

namespace WelpenWache.Api.Security;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; init; } = "WelpenWache.Api";

    public string Audience { get; init; } = "WelpenWache.Frontend";

    public string SigningKey { get; init; } = string.Empty;

    public int ExpiresInHours { get; init; } = 12;

    public static JwtOptions Resolve(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var signingKey = configuration[$"{SectionName}:SigningKey"];
        if (string.IsNullOrWhiteSpace(signingKey))
        {
            signingKey = environment.IsDevelopment()
                ? Convert.ToBase64String(RandomNumberGenerator.GetBytes(64))
                : throw new InvalidOperationException("Jwt:SigningKey muss gesetzt sein.");
        }

        return new JwtOptions
        {
            Issuer = configuration[$"{SectionName}:Issuer"] ?? "WelpenWache.Api",
            Audience = configuration[$"{SectionName}:Audience"] ?? "WelpenWache.Frontend",
            SigningKey = signingKey,
            ExpiresInHours = configuration.GetValue<int?>($"{SectionName}:ExpiresInHours") ?? 12
        };
    }
}

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace WelpenWache.Api.Services;

public sealed record StoredTemplateFile(
    string RelativeFilePath,
    string OriginalFileName);

public sealed class TemplateStorageService(IOptions<DocumentStorageOptions> options)
{
    private readonly string basePath = ResolveBasePath(options.Value.BasePath);

    public string ResolveTemplatePath(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            throw new InvalidOperationException("Der relative Dateipfad der Vorlage fehlt.");
        }

        var normalizedRelativePath = NormalizeRelativePath(relativePath);
        var fullPath = Path.GetFullPath(Path.Combine(basePath, normalizedRelativePath));

        if (!fullPath.StartsWith(basePath, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Der relative Dateipfad der Vorlage ist ungültig.");
        }

        return fullPath;
    }

    public async Task<StoredTemplateFile> SaveTemplateAsync(IFormFile file, CancellationToken cancellationToken)
    {
        ValidateTemplateFile(file);

        Directory.CreateDirectory(basePath);
        var relativePath = $"templates/{Guid.NewGuid():N}{Path.GetExtension(file.FileName).ToLowerInvariant()}";
        var fullPath = ResolveTemplatePath(relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using var targetStream = File.Create(fullPath);
        await file.CopyToAsync(targetStream, cancellationToken);

        return new StoredTemplateFile(relativePath, Path.GetFileName(file.FileName));
    }

    public void DeleteTemplate(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            return;
        }

        var fullPath = ResolveTemplatePath(relativePath);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }

    public static void ValidateTemplateFile(IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            throw new InvalidOperationException("Es muss eine DOCX-Vorlage hochgeladen werden.");
        }

        if (!string.Equals(Path.GetExtension(file.FileName), ".docx", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Es werden aktuell nur DOCX-Vorlagen unterstützt.");
        }
    }

    private static string ResolveBasePath(string configuredPath)
    {
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            throw new InvalidOperationException("DocumentStorage:BasePath muss gesetzt sein.");
        }

        if (!Path.IsPathRooted(configuredPath))
        {
            throw new InvalidOperationException("DocumentStorage:BasePath muss ein absoluter Pfad sein.");
        }

        return Path.GetFullPath(configuredPath.Trim());
    }

    private static string NormalizeRelativePath(string relativePath)
    {
        var normalized = relativePath
            .Replace('\\', '/')
            .Trim('/');

        if (normalized.Contains("..", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Der relative Dateipfad der Vorlage ist ungültig.");
        }

        return normalized.Replace('/', Path.DirectorySeparatorChar);
    }
}

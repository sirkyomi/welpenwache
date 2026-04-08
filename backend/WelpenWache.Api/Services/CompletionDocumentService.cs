using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;
using DocxTemplater;
using DocxTemplater.Model;
using Microsoft.Extensions.Options;
using WelpenWache.Api.Domain;

namespace WelpenWache.Api.Services;

public sealed record GeneratedCompletionDocument(
    string FileName,
    string ContentType,
    byte[] Content);

public sealed class CompletionDocumentService(
    IOptions<CompletionDocumentOptions> options,
    TemplateStorageService templateStorageService)
{
    private static readonly IReadOnlyDictionary<string, CultureInfo> SupportedCultures =
        new Dictionary<string, CultureInfo>(StringComparer.OrdinalIgnoreCase)
        {
            ["de"] = CultureInfo.GetCultureInfo("de-DE"),
            ["en"] = CultureInfo.GetCultureInfo("en-US")
        };

    private readonly CompletionDocumentOptions completionOptions = options.Value;

    public async Task<IReadOnlyList<GeneratedCompletionDocument>> GenerateAsync(
        Intern intern,
        IReadOnlyList<DocumentTemplate> templates,
        CancellationToken cancellationToken)
    {
        var generatedDocuments = new List<GeneratedCompletionDocument>(templates.Count);

        foreach (var template in templates.OrderBy(item => item.Name, StringComparer.CurrentCultureIgnoreCase))
        {
            cancellationToken.ThrowIfCancellationRequested();

            var filePath = templateStorageService.ResolveTemplatePath(template.RelativeFilePath);
            if (!File.Exists(filePath))
            {
                throw new InvalidOperationException($"Die Vorlagendatei \"{template.OriginalFileName}\" wurde nicht gefunden.");
            }

            var documentBytes = await File.ReadAllBytesAsync(filePath, cancellationToken);
            generatedDocuments.Add(new GeneratedCompletionDocument(
                BuildDownloadFileName(intern, template),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                RenderDocument(documentBytes, intern, template)));
        }

        return generatedDocuments;
    }

    public GeneratedCompletionDocument CreateArchive(Intern intern, IReadOnlyList<GeneratedCompletionDocument> documents)
    {
        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var document in documents)
            {
                var entry = archive.CreateEntry(document.FileName, CompressionLevel.Optimal);
                using var entryStream = entry.Open();
                entryStream.Write(document.Content, 0, document.Content.Length);
            }
        }

        return new GeneratedCompletionDocument(
            $"{SanitizeFileName(intern.FullName)}-abschlussdokumente.zip",
            "application/zip",
            buffer.ToArray());
    }

    private byte[] RenderDocument(byte[] templateBytes, Intern intern, DocumentTemplate template)
    {
        var culture = ResolveCulture(template.Language);
        var model = BuildTemplateModel(intern, template.Language, culture);
        using var templateStream = new MemoryStream(templateBytes, writable: false);
        using var documentTemplate = new DocxTemplate(templateStream, new ProcessSettings
        {
            Culture = culture,
            BindingErrorHandling = BindingErrorHandling.SkipBindingAndRemoveContent,
            IgnoreLineBreaksAroundTags = true
        });

        documentTemplate.BindModel("ds", model);
        BindTopLevelMembers(documentTemplate, model);

        using var resultStream = new MemoryStream();
        var processedStream = documentTemplate.Process();
        processedStream.Position = 0;
        processedStream.CopyTo(resultStream);

        return ApplyScalarPlaceholderFallback(resultStream.ToArray(), model);
    }

    private static void BindTopLevelMembers(DocxTemplate documentTemplate, CompletionTemplateModel model)
    {
        documentTemplate.BindModel(nameof(model.first_name), model.first_name);
        documentTemplate.BindModel(nameof(model.last_name), model.last_name);
        documentTemplate.BindModel(nameof(model.full_name), model.full_name);
        documentTemplate.BindModel(nameof(model.school), model.school);
        documentTemplate.BindModel(nameof(model.notes), model.notes);
        documentTemplate.BindModel(nameof(model.gender), model.gender);
        documentTemplate.BindModel(nameof(model.salutation), model.salutation);
        documentTemplate.BindModel(nameof(model.start_date), model.start_date);
        documentTemplate.BindModel(nameof(model.end_date), model.end_date);
        documentTemplate.BindModel(nameof(model.team), model.team);
        documentTemplate.BindModel(nameof(model.internship_count), model.internship_count);
        documentTemplate.BindModel(nameof(model.team_assignments), model.team_assignments);
        documentTemplate.BindModel(nameof(model.internships), model.internships);
    }

    private CompletionTemplateModel BuildTemplateModel(Intern intern, string language, CultureInfo culture)
    {
        var internships = intern.Internships
            .OrderBy(item => item.StartDate)
            .ToList();
        var assignments = internships
            .SelectMany(internship => internship.Assignments.Select(assignment => new { internship, assignment }))
            .OrderBy(item => item.assignment.StartDate)
            .ToList();

        return new CompletionTemplateModel(
            intern.FirstName,
            intern.LastName,
            intern.FullName,
            intern.School ?? string.Empty,
            intern.Notes ?? string.Empty,
            InternGender.Normalize(intern.Gender),
            ResolveSalutation(intern.Gender, language),
            internships.Count > 0 ? FormatDate(internships[0].StartDate, culture) : string.Empty,
            internships.Count > 0 ? FormatDate(internships[^1].EndDate, culture) : string.Empty,
            string.Join(", ", assignments
                .Select(item => item.assignment.Team.Name)
                .Distinct(StringComparer.CurrentCultureIgnoreCase)),
            internships.Count,
            assignments.Select(item => new CompletionTemplateAssignmentModel(
                item.assignment.Team.Name,
                item.assignment.Supervisor?.Name ?? string.Empty,
                FormatDate(item.assignment.StartDate, culture),
                FormatDate(item.assignment.EndDate, culture),
                FormatDate(item.internship.StartDate, culture),
                FormatDate(item.internship.EndDate, culture)))
                .ToList(),
            internships.Select(internship => new CompletionTemplateInternshipModel(
                FormatDate(internship.StartDate, culture),
                FormatDate(internship.EndDate, culture),
                internship.Note ?? string.Empty,
                internship.Assignments
                    .OrderBy(item => item.StartDate)
                    .Select(assignment => new CompletionTemplateAssignmentModel(
                        assignment.Team.Name,
                        assignment.Supervisor?.Name ?? string.Empty,
                        FormatDate(assignment.StartDate, culture),
                        FormatDate(assignment.EndDate, culture),
                        FormatDate(internship.StartDate, culture),
                        FormatDate(internship.EndDate, culture)))
                    .ToList()))
                .ToList());
    }

    private string ResolveSalutation(string gender, string language)
    {
        var normalizedGender = InternGender.Normalize(gender);
        if (completionOptions.Salutations.TryGetValue(normalizedGender, out var languageMap)
            && languageMap.TryGetValue(language, out var salutation)
            && !string.IsNullOrWhiteSpace(salutation))
        {
            return salutation.Trim();
        }

        throw new InvalidOperationException(
            $"Für das Geschlecht \"{normalizedGender}\" und die Sprache \"{language}\" ist keine Anrede konfiguriert.");
    }

    private static CultureInfo ResolveCulture(string language) =>
        SupportedCultures.TryGetValue(language, out var culture)
            ? culture
            : throw new InvalidOperationException($"Die Vorlagensprache \"{language}\" wird nicht unterstützt.");

    private static string FormatDate(DateOnly value, CultureInfo culture) =>
        value.ToDateTime(TimeOnly.MinValue).ToString("d", culture);

    private static string BuildDownloadFileName(Intern intern, DocumentTemplate template)
    {
        var extension = Path.GetExtension(template.OriginalFileName);
        return $"{SanitizeFileName(intern.FullName)}-{SanitizeFileName(template.Name)}{extension}";
    }

    private static string SanitizeFileName(string value)
    {
        var invalidChars = Path.GetInvalidFileNameChars();
        var sanitizedChars = value
            .Trim()
            .Select(character => invalidChars.Contains(character) ? '-' : character)
            .ToArray();

        return string.IsNullOrWhiteSpace(new string(sanitizedChars))
            ? "dokument"
            : new string(sanitizedChars);
    }

    private static byte[] ApplyScalarPlaceholderFallback(byte[] documentBytes, CompletionTemplateModel model)
    {
        using var archiveStream = new MemoryStream();
        archiveStream.Write(documentBytes, 0, documentBytes.Length);
        archiveStream.Position = 0;

        using (var archive = new ZipArchive(archiveStream, ZipArchiveMode.Update, leaveOpen: true))
        {
            var replacements = BuildScalarReplacements(model);

            foreach (var entry in archive.Entries.Where(item =>
                         item.FullName.StartsWith("word/", StringComparison.OrdinalIgnoreCase)
                         && item.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase)))
            {
                using var reader = new StreamReader(entry.Open(), Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: false);
                var xml = reader.ReadToEnd();
                var updatedXml = replacements.Aggregate(xml, (current, replacement) =>
                    current.Replace(replacement.Key, SecurityElement.Escape(replacement.Value) ?? string.Empty, StringComparison.Ordinal));

                if (ReferenceEquals(xml, updatedXml) || xml == updatedXml)
                {
                    continue;
                }

                using var writableStream = entry.Open();
                writableStream.SetLength(0);
                using var writer = new StreamWriter(writableStream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false), leaveOpen: true);
                writer.Write(updatedXml);
                writer.Flush();
            }
        }

        return archiveStream.ToArray();
    }

    private static Dictionary<string, string> BuildScalarReplacements(CompletionTemplateModel model) =>
        new(StringComparer.Ordinal)
        {
            ["{{first_name}}"] = model.first_name,
            ["{{last_name}}"] = model.last_name,
            ["{{full_name}}"] = model.full_name,
            ["{{school}}"] = model.school,
            ["{{notes}}"] = model.notes,
            ["{{gender}}"] = model.gender,
            ["{{salutation}}"] = model.salutation,
            ["{{start_date}}"] = model.start_date,
            ["{{end_date}}"] = model.end_date,
            ["{{team}}"] = model.team,
            ["{{internship_count}}"] = model.internship_count.ToString(CultureInfo.InvariantCulture),
            ["{{ds.first_name}}"] = model.first_name,
            ["{{ds.last_name}}"] = model.last_name,
            ["{{ds.full_name}}"] = model.full_name,
            ["{{ds.school}}"] = model.school,
            ["{{ds.notes}}"] = model.notes,
            ["{{ds.gender}}"] = model.gender,
            ["{{ds.salutation}}"] = model.salutation,
            ["{{ds.start_date}}"] = model.start_date,
            ["{{ds.end_date}}"] = model.end_date,
            ["{{ds.team}}"] = model.team,
            ["{{ds.internship_count}}"] = model.internship_count.ToString(CultureInfo.InvariantCulture)
        };

    private sealed record CompletionTemplateModel(
        string first_name,
        string last_name,
        string full_name,
        string school,
        string notes,
        string gender,
        string salutation,
        string start_date,
        string end_date,
        string team,
        int internship_count,
        IReadOnlyList<CompletionTemplateAssignmentModel> team_assignments,
        IReadOnlyList<CompletionTemplateInternshipModel> internships);

    private sealed record CompletionTemplateInternshipModel(
        string start_date,
        string end_date,
        string note,
        IReadOnlyList<CompletionTemplateAssignmentModel> assignments);

    private sealed record CompletionTemplateAssignmentModel(
        string team_name,
        string supervisor_name,
        string start_date,
        string end_date,
        string internship_start_date,
        string internship_end_date);
}

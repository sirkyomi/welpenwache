using Microsoft.EntityFrameworkCore;
using WelpenWache.Api.Contracts;
using WelpenWache.Api.Data;
using WelpenWache.Api.Domain;

namespace WelpenWache.Api.Endpoints;

public static class CalendarEndpoints
{
    public static IEndpointRouteBuilder MapCalendarEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/calendar")
            .RequireAuthorization(PermissionCatalog.InternsView);

        group.MapGet("/month", async (int year, int month, ApplicationDbContext dbContext) =>
        {
            if (year is < 2000 or > 2100 || month is < 1 or > 12)
            {
                return Results.BadRequest(new ApiError("VALIDATION_ERROR", "Jahr oder Monat sind ungueltig."));
            }

            var monthStart = new DateOnly(year, month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);

            var internships = await dbContext.Internships
                .Include(internship => internship.Intern)
                .Include(internship => internship.Assignments)
                    .ThenInclude(assignment => assignment.Team)
                .Include(internship => internship.Assignments)
                    .ThenInclude(assignment => assignment.Supervisor)
                .Where(internship => internship.EndDate >= monthStart && internship.StartDate <= monthEnd)
                .OrderBy(internship => internship.StartDate)
                .ThenBy(internship => internship.Intern.LastName)
                .ToListAsync();

            var days = Enumerable.Range(0, monthEnd.Day)
                .Select(offset =>
                {
                    var date = monthStart.AddDays(offset);
                    var entries = internships
                        .SelectMany(internship => internship.Assignments
                            .Where(assignment => assignment.StartDate <= date && assignment.EndDate >= date)
                            .Select(assignment => new CalendarDayEntryResponse(
                                internship.InternId,
                                internship.Intern.FullName,
                                internship.Id,
                                assignment.TeamId,
                                assignment.Team.Name,
                                assignment.Team.ColorHex,
                                assignment.SupervisorId,
                                assignment.Supervisor?.Name)))
                        .OrderBy(entry => entry.TeamName)
                        .ThenBy(entry => entry.InternName)
                        .ToList();

                    return new CalendarDayResponse(date, entries);
                })
                .ToList();

            return Results.Ok(new CalendarMonthResponse(year, month, days));
        });

        return endpoints;
    }
}

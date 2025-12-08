using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Ticketing.Backend.Domain.Entities;
using Ticketing.Backend.Domain.Enums;

namespace Ticketing.Backend.Infrastructure.Data;

public static class SeedData
{
    public static async Task InitializeAsync(AppDbContext context, IPasswordHasher<User> passwordHasher)
    {
        await context.Database.MigrateAsync();

        if (context.Users.Any())
        {
            return;
        }

        var admin = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Admin User",
            Email = "admin@test.com",
            Role = UserRole.Admin,
            PhoneNumber = "+989000000000",
            Department = "IT",
            CreatedAt = DateTime.UtcNow
        };
        admin.PasswordHash = passwordHasher.HashPassword(admin, "Admin123!");

        var tech1 = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Tech One",
            Email = "tech1@test.com",
            Role = UserRole.Technician,
            PhoneNumber = "+989000000001",
            Department = "Field Support",
            CreatedAt = DateTime.UtcNow
        };
        tech1.PasswordHash = passwordHasher.HashPassword(tech1, "Tech123!");
        var tech2 = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Tech Two",
            Email = "tech2@test.com",
            Role = UserRole.Technician,
            PhoneNumber = "+989000000002",
            Department = "Network",
            CreatedAt = DateTime.UtcNow
        };
        tech2.PasswordHash = passwordHasher.HashPassword(tech2, "Tech123!");

        var client1 = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Client One",
            Email = "client1@test.com",
            Role = UserRole.Client,
            PhoneNumber = "+989000000010",
            Department = "Finance",
            CreatedAt = DateTime.UtcNow
        };
        client1.PasswordHash = passwordHasher.HashPassword(client1, "Client123!");
        var client2 = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Client Two",
            Email = "client2@test.com",
            Role = UserRole.Client,
            PhoneNumber = "+989000000011",
            Department = "Sales",
            CreatedAt = DateTime.UtcNow
        };
        client2.PasswordHash = passwordHasher.HashPassword(client2, "Client123!");

        context.Users.AddRange(admin, tech1, tech2, client1, client2);

        var categories = new List<Category>
        {
            new()
            {
                Name = "Networking",
                Description = "Switches, routers, VPN",
                Subcategories = new List<Subcategory>
                {
                    new() { Name = "VPN" },
                    new() { Name = "WiFi" },
                    new() { Name = "Firewall" }
                }
            },
            new()
            {
                Name = "Hardware",
                Description = "Laptops and peripherals",
                Subcategories = new List<Subcategory>
                {
                    new() { Name = "Laptop" },
                    new() { Name = "Printer" },
                    new() { Name = "Monitor" }
                }
            },
            new()
            {
                Name = "Software",
                Description = "OS and application issues",
                Subcategories = new List<Subcategory>
                {
                    new() { Name = "Windows" },
                    new() { Name = "Office" },
                    new() { Name = "Antivirus" }
                }
            }
        };

        context.Categories.AddRange(categories);
        await context.SaveChangesAsync();

        // Map category ids
        var networking = categories.First();
        var hardware = categories.Skip(1).First();
        var software = categories.Last();

        var tickets = new List<Ticket>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Title = "VPN not connecting",
                Description = "Cannot connect to VPN on Windows 11",
                CategoryId = networking.Id,
                SubcategoryId = networking.Subcategories.First().Id,
                Priority = TicketPriority.High,
                Status = TicketStatus.New,
                CreatedByUserId = client1.Id,
                AssignedToUserId = tech1.Id,
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            },
            new()
            {
                Id = Guid.NewGuid(),
                Title = "Printer jam on 3rd floor",
                Description = "Paper jam keeps returning",
                CategoryId = hardware.Id,
                SubcategoryId = hardware.Subcategories.First(sc => sc.Name == "Printer").Id,
                Priority = TicketPriority.Medium,
                Status = TicketStatus.InProgress,
                CreatedByUserId = client2.Id,
                AssignedToUserId = tech2.Id,
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                DueDate = DateTime.UtcNow.AddDays(2)
            },
            new()
            {
                Id = Guid.NewGuid(),
                Title = "Outlook keeps crashing",
                Description = "Crashes when opening calendar",
                CategoryId = software.Id,
                SubcategoryId = software.Subcategories.First(sc => sc.Name == "Office").Id,
                Priority = TicketPriority.Critical,
                Status = TicketStatus.InProgress,
                CreatedByUserId = client1.Id,
                AssignedToUserId = tech1.Id,
                CreatedAt = DateTime.UtcNow.AddHours(-8)
            },
            new()
            {
                Id = Guid.NewGuid(),
                Title = "Request new laptop",
                Description = "Need new laptop for new hire",
                CategoryId = hardware.Id,
                SubcategoryId = hardware.Subcategories.First(sc => sc.Name == "Laptop").Id,
                Priority = TicketPriority.Low,
                Status = TicketStatus.WaitingForClient,
                CreatedByUserId = client2.Id,
                AssignedToUserId = tech2.Id,
                CreatedAt = DateTime.UtcNow.AddDays(-5)
            },
            new()
            {
                Id = Guid.NewGuid(),
                Title = "WiFi drops in conference room",
                Description = "Signal weak in conference area",
                CategoryId = networking.Id,
                SubcategoryId = networking.Subcategories.First(sc => sc.Name == "WiFi").Id,
                Priority = TicketPriority.High,
                Status = TicketStatus.Resolved,
                CreatedByUserId = client2.Id,
                AssignedToUserId = tech1.Id,
                CreatedAt = DateTime.UtcNow.AddDays(-3),
                UpdatedAt = DateTime.UtcNow.AddDays(-1)
            }
        };

        context.Tickets.AddRange(tickets);
        await context.SaveChangesAsync();

        var messages = new List<TicketMessage>
        {
            new()
            {
                Id = Guid.NewGuid(),
                TicketId = tickets[0].Id,
                AuthorUserId = client1.Id,
                Message = "Issue started after update",
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                Status = TicketStatus.New
            },
            new()
            {
                Id = Guid.NewGuid(),
                TicketId = tickets[0].Id,
                AuthorUserId = tech1.Id,
                Message = "Checking logs and VPN client version",
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                Status = TicketStatus.InProgress
            },
            new()
            {
                Id = Guid.NewGuid(),
                TicketId = tickets[2].Id,
                AuthorUserId = tech1.Id,
                Message = "Reinstalling Office to fix crash",
                CreatedAt = DateTime.UtcNow.AddHours(-6),
                Status = TicketStatus.InProgress
            }
        };

        context.TicketMessages.AddRange(messages);

        var notifications = new List<Notification>
        {
            new()
            {
                Id = Guid.NewGuid(),
                UserId = tech1.Id,
                Message = "New ticket assigned: VPN not connecting",
                IsRead = false,
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            },
            new()
            {
                Id = Guid.NewGuid(),
                UserId = client1.Id,
                Message = "Technician replied to your ticket",
                IsRead = false,
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            }
        };

        context.Notifications.AddRange(notifications);
        await context.SaveChangesAsync();
    }
}

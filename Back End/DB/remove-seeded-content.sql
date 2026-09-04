START TRANSACTION;

DELETE FROM "ContentChangeRequests"
WHERE "ChangeCode" IN ('CHG-000001', 'CHG-000002')
   OR "Message" LIKE 'Seeded%';

DELETE FROM "AdminRequests"
WHERE "RequestCode" = 'AREQ-000001'
   OR "Message" LIKE 'Seeded%';

DELETE FROM "ConcertSongs"
WHERE "ConcertId" IN (
    SELECT "ConcertId"
    FROM "Concerts"
    WHERE "Location" = 'Seeded Sofia Club'
)
OR "SongId" IN (
    SELECT "SongId"
    FROM "Singles"
    WHERE "SongName" IN ('Seeded First Single', 'Seeded Second Single')
);

DELETE FROM "Singles"
WHERE "SongName" IN ('Seeded First Single', 'Seeded Second Single');

DELETE FROM "Concerts"
WHERE "Location" = 'Seeded Sofia Club';

DELETE FROM "Albums"
WHERE "Title" = 'Seeded Demo Album';

DELETE FROM "News"
WHERE "Title" = 'Seeded News Post';

DELETE FROM "TimeLines"
WHERE "Event" = 'SEEDED MILESTONE';

DELETE FROM "Members"
WHERE "Name" IN ('Seeded Vocalist', 'Seeded Guitarist');

DELETE FROM "Gallery"
WHERE "Title" = 'Seeded Gallery Image';

COMMIT;

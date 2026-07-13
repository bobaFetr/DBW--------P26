// Temporary public content.
// Set NEXT_PUBLIC_CONTENT_SOURCE=temporary to use this file on the public site.
// Set NEXT_PUBLIC_CONTENT_SOURCE=backend to use the database/admin system.
export const temporaryContent = {
  albums: [
    // {
    //   albumId: 1,
    //   title: "Album title",
    //   releaseDate: "2026-01-01",
    //   photoUrl: "/album-cover.jpg",
    //   numberOfSongs: 10,
    //   trackListJson: JSON.stringify([
    //     { songName: "Song title", duration: "3:30", text: "Lyrics or notes" }
    //   ])
    // }
  ],
  singles: [
    {
      songId: 1,
      songName: "Coma Distraction - instrumental",
      releaseDate: "13-07-2026",
      availableOnYoutube: "https://youtu.be/t2w8rrT-EUk?si=TeDFE7V4i9gbQm8g",
      photoUrl: "/public/singles/coma-distraction-instrumental.jpg",
      description: "........"
    }
  ],
  concerts: [
    // {
    //   concertId: 1,
    //   date: "2026-01-01",
    //   time: "20:00",
    //   location: "Venue, City",
    //   numberOfSongs: 12
    // }
  ],
  news: [
    // {
    //   newsId: 1,
    //   title: "News title",
    //   content: "News text",
    //   publicationDate: "2026-01-01",
    //   author: "Paralyze"
    // }
  ],
  members: [
    // {
    //   id: 1,
    //   name: "Member name",
    //   instrument: "Instrument",
    //   photoUrl: "/member-photo.jpg"
    // }
  ],
  timeline: [
    // {
    //   id: 1,
    //   date: "2026-01-01",
    //   event: "Timeline event",
    //   description: "What happened",
    //   location: "Optional location"
    // }
  ]
};

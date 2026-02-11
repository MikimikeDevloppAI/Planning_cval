require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Find Porrentruy site id
  const site = await client.query(`SELECT id_site FROM sites WHERE name ILIKE '%porrentruy%'`);
  const idSite = site.rows[0].id_site;
  console.log('Porrentruy id_site:', idSite);

  // Find all staff
  const interdit = ['Bron', 'Pratillo', 'Spring'];
  const eviter = ['Etique', 'Hasani', 'Jurot', 'Lambelet', 'Lovis', 'Ramseier'];

  const allNames = [...interdit, ...eviter];
  const staff = await client.query(
    `SELECT id_staff, lastname, firstname FROM staff WHERE lastname = ANY($1)`,
    [allNames]
  );

  console.log('\nStaff found:');
  staff.rows.forEach(r => console.log(`  ${r.lastname} ${r.firstname} (id=${r.id_staff})`));

  // Check all found
  const found = staff.rows.map(r => r.lastname);
  const missing = allNames.filter(n => !found.includes(n));
  if (missing.length > 0) {
    console.log('\nMISSING:', missing);
    await client.end();
    return;
  }

  // Insert preferences
  for (const row of staff.rows) {
    const pref = interdit.includes(row.lastname) ? 'INTERDIT' : 'EVITER';
    await client.query(
      `INSERT INTO staff_preferences (id_staff, target_type, id_site, preference)
       VALUES ($1, 'SITE', $2, $3)`,
      [row.id_staff, idSite, pref]
    );
    console.log(`  ${row.lastname} ${row.firstname} -> ${pref} Porrentruy`);
  }

  console.log('\nDone!');
  await client.end();
}
main();

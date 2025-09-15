import { Vercel } from 'npm:@vercel/sdk';
import { publicIpv4 } from "npm:public-ip";

const vercel = new Vercel({
    bearerToken: Deno.env.get('VERCEL_TOKEN')!
});

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateIp() {
    const teams = (await vercel.teams.getTeams({})).teams;
    const team = teams
        .filter(team => team.id == Deno.env.get("VERCEL_TEAM_ID"))[0];

    const records = await vercel.dns.getRecords({
        domain: Deno.env.get("VERCEL_DOMAIN")!,
        teamId: team.id,
        limit: "100"
    });

    if(typeof records === "string") {
        return;
    }

    const ip = await publicIpv4();

    let filtered = records.records
        .filter(record => Deno.env.get("UPDATE_RECORDS_LIST").split(",").includes(record.name))
        .filter(record => record.type == "A")
        .filter(record => record.value != ip);

    if(filtered.length == 0) {
        console.log("No record to update");
        return;
    }

    for (let record of filtered) {
        console.log(`Updating ${record.name} to ${ip}`);

        await vercel.dns.updateRecord({
            recordId: record.id,
            teamId: team.id,
            requestBody: {
                name: record.name,
                value: ip,
                type: "A",
                ttl: 60,
                srv: null,
                https: null,
                comment: "Automatic ip update"
            }
        });
    }
}

async function main() {
    while(true) {
        try {
            await updateIp();
        } catch (e) {
            console.error("Erreur lors de la mise à jour de l'ip :", e);
            break;
        }

        await sleep(60 * 1000); // 1 minute
    }
}

main().catch(console.error);
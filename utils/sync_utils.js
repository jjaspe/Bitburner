export async function syncPurchased(ns) {
	const myServers = ns.getPurchasedServers();
	await syncServers(ns, myServers);
}

export async function syncServers(ns, servers) {
	const mainRunner = 'runner.js';
	const hackFiles = ns.ls('home', '/hacks/');
	const utilFiles = ns.ls('home', '/utils/');
	for (const server of servers) {
		await ns.scp(mainRunner, 'home', server).then(async (data) => {
			ns.print('successfully copied runner');
			await ns.scp(hackFiles, 'home', server).then(async (data) => {
				ns.print('successfully copied hack files');
				await ns.scp(utilFiles, 'home', server).then((data) => {
					ns.print('successfully copied util files');
				})
			});
		});
	}
}

export async function main(ns) {
	await syncPurchased(ns)
}
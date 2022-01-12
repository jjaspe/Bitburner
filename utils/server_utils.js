import { syncPurchased } from './utils/sync_utils'

/** @param {NS} ns **/
export class ServerUtils {
	constructor(ns) {
        this.ns = ns;
		this.SMALL = 8000
    }

	/** @param {NS} ns **/
	getCrackLevel = () => {
		if(this.ns.fileExists('BruteSSH.exe')){
			if(this.ns.fileExists('FTPCrack.exe')){
				if(this.ns.fileExists('relaySMTP.exe')){
					if(this.ns.fileExists('HTTPWorm.exe')){
						if(this.ns.fileExists('SQLInject.exe'))
							return 5;
						else
							return 4;
					}else{
						return 3
					}
				}else{
					return 2
				}				
			}else{
				return 1;
			}
		}else{
			return 0
		}
	}

	/** @param {NS} ns **/
	crack = (host) => {
		var ports = this.ns.getServerNumPortsRequired(host)
		this.open(host, ports)
	}

	/** @param {NS} ns **/
	open = (host, level) => {
		this.ns.print(`Opening ${host} which needs ${level} open ports`)
		switch(level){
			case 5:
				this.ns.sqlinject(host)
			case 4:
				this.ns.httpworm(host)
			case 3:
				this.ns.relaysmtp(host)
			case 2:
				this.ns.ftpcrack(host);
			case 1:
				this.ns.brutessh(host);
			case 0:
				this.ns.nuke(host);
				break;
		}
	}
	
	/** @param {NS} ns **/
	openHosts(level) {
		const openHosts = (host, checked, opened) => {
			var hosts = this.ns.scan(host)
			checked.push(host)
			hosts
				.filter(n => checked.indexOf(n) == -1)
				.forEach(n => {
					var ports = this.ns.getServerNumPortsRequired(n)
					if(ports <= level){
						this.ns.print(`Opening ${n}`)
						this.open(n, ports)
						opened.push(n)
						opened = openHosts(n, checked, opened)
					}
				})
			return opened;
		}
		var checked = this.ns.getPurchasedServers()
		var opened = openHosts("home",checked,[])		
		return opened;
	}

	nuke(level) {
		var hosts = this.scanExistingServers(level)
		hosts.forEach(n => {
			this.ns.print(`Nuking ${n}`);
			this.ns.nuke(n);
		})
	}

	getNextConnectedHosts(host, checked, maxLevel) {
		var hosts = this.ns
			.scan(host)
			.filter(n => this.ns.getServerNumPortsRequired(n) <= maxLevel)
			.filter(n => checked.indexOf(n) == -1)
		return hosts;
	}

	getAllConnectedHosts(host, checked, maxLevel) {
		var allHosts = []
		var hosts = this.getNextConnectedHosts(host, checked, maxLevel);
		allHosts = allHosts.concat(hosts)
		checked.push(host)
		checked = checked.concat(allHosts)
		hosts.forEach(n => {
			var nextHosts = this.getAllConnectedHosts(n, checked, maxLevel)
			allHosts = allHosts.concat(nextHosts)
			checked = checked.concat(nextHosts)
		})

		return allHosts;
	}

	/** @param {NS} ns **/
	getHackableExistingServers(maxLevel) {
		var purchased = this.ns.getPurchasedServers()
		if(!maxLevel)
			maxLevel = this.getCrackLevel()
		var hackableHosts = this.getAllConnectedHosts("home",purchased,maxLevel)
			.filter(n => this.ns.getServerMaxMoney(n) > 0)
			.filter(n => this.ns.getHackingLevel() > this.ns.getServerRequiredHackingLevel(n))
		return hackableHosts;
	}

	getExistingServers() {
		var servers = ["n00dles",
			"sigma-cosmetics",
			"joesguns",
			"nectar-net",
			"hong-fang-tea",
			"harakiri-sushi",
			"neo-net",
			"zer0",
			"max-hardware",
			"iron-gym"];
		return servers;
	}

	isSmallServer(ramSize) {
		return ramSize <= this.SMALL;
	}

	/** @param {NS} ns **/
	getPurchasedServers = (type) => {
		if(!type)
			type = 'all'
		var servers = [];
		switch(type){
			case 'all':
				servers = servers.concat(this.getBigPurchasedServers());
				servers = servers.concat(this.getSmallPurchasedServers());
				break;
			case 'small':
				servers = servers.concat(this.getSmallPurchasedServers());
				break;
			case 'big':
				servers = servers.concat(this.getBigPurchasedServers());
				break;
			default:
				break;
		}
		return servers;		
	}

	getSizeFromName = (server) => {
		var r = /pserv-(\d+)/g
		var match = r.exec(server)
		return parseInt(match[1])
	}

	/** @param {NS} ns **/
	getSmallPurchasedServers() {
		var purchased = this.ns.getPurchasedServers();
		return purchased.filter(n => {
			var r = /pserv-(\d+)/g
			var match = r.exec(n)
			return parseInt(match[1]) <= this.SMALL
		})
	}

	getBigPurchasedServers() {
		var purchased = this.ns.getPurchasedServers();
		return purchased.filter(n => {
			var r = /pserv-(\d+)/g
			var match = r.exec(n)
			return parseInt(match[1]) > this.SMALL
		});
	}

	/** @param {NS} ns **/
	getMoneyFraction(server) {
		var max_money = this.ns.getServerMaxMoney(server);
		var current_money = this.ns.getServerMoneyAvailable(server);
		return Math.floor(current_money / max_money)
	}

	/** @param {NS} ns **/
	getSecurityAboveMin(server) {
		var min_sec = this.ns.getServerMinSecurityLevel(server)
		var cur_sec = this.ns.getServerSecurityLevel(server);
		return cur_sec - min_sec;
	}

	/** @param {NS} ns **/
	getHackableServer(moneyFraction, securityAboveMin) {
		var servers = getExistingServers()
		for (var i = 0; i < servers.length; i++) {
			var server = servers[i]
			var curMoneyFraction = getMoneyFraction(server)
			var curMinSecurity = getSecurityAboveMin(server)
			if (curMoneyFraction > moneyFraction && curMinSecurity < securityAboveMin)
				return server;
		}
		return null;
	}

	getMaxNewServerRam = () => {
		var current_money = this.ns.getServerMoneyAvailable("home")
		var max_ram = 0
		for (var i = 1; i <= 20; i++) {
			var cost = this.ns.getPurchasedServerCost(Math.pow(2, i))
			if (current_money > cost)
				max_ram = Math.pow(2, i)
			else
				return max_ram;
		}
		return Math.pow(2, 20);
	}

	getLowestServer = (servers) => {
		var lowest = Math.pow(2, 21);
		var lowest_index = null
		for (var i = 0; i < servers.length; i++) {
			var c_ram = this.ns.getServerMaxRam(servers[i])
			if (c_ram < lowest) {
				lowest = c_ram
				lowest_index = i
			}
		}
		return [lowest, lowest_index];
	}

	upgrade = async () => {
		var runs = 0
		var new_servers = [];
		while (true) {
			var pServers = this.ns.getPurchasedServers()
			var max_new_ram = this.getMaxNewServerRam();
			var lowest = this.getLowestServer(pServers);
			if(lowest[0] >= max_new_ram || max_new_ram == 0){
				break;
			} 
			else {
				this.ns.print(`Lowest server has ${lowest[0]} ram, can purchase one with ${max_new_ram} ram`)
				var to_delete = pServers[lowest[1]]
				this.ns.killall(to_delete)
				var deleted = this.ns.deleteServer(to_delete)
				if(deleted){
					var new_server = this.ns.purchaseServer(`pserv-${max_new_ram}-`, max_new_ram);
					new_servers.push(new_server);
				}			
			}
			runs++;
			if(runs > 25)
				break;

			await this.ns.sleep(1);
		}

		if(new_servers.length > 0)			
			this.ns.print(`Purchased ${new_servers.length } new servers, start synching files`)

		return await syncPurchased(this.ns)
			.then(n => new_servers);
	}

	/** @param {NS} ns **/
	startServers(servers, type) {
		if(type == 'small'){
			servers = servers.filter(n => this.isSmallServer(this.getSizeFromName(n)))
		}
		const runRunner = (server) => {
			const runningScripts = this.ns.isRunning('runner.js', server);
			if (!runningScripts) {
				this.ns.exec('runner.js', server, 1); // Will get accurate max thread use for chain in future
			} else {
				this.ns.print('Scripts already running');
			}
		}
		servers.forEach(n => runRunner(n));
	}
}
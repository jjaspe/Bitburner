import { ServerUtils } from './utils/server_utils'
import {syncPurchased} from './utils/sync_utils'

export class UpgradeUtils {
	constructor(ns){
		this.ns = ns;
		this.serverUtils = new ServerUtils(ns)
	}

	getHighestServerRam = (servers) => {
		var rams = servers.map(n => this.serverUtils.getSizeFromName(n))
		var max = rams.reduce((a,b) => a > b ? a :b)
		return max;
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

	areAllServersSameRam = (pServers) => {
		var highest = this.getHighestServerRam(pServers);
		var lowest = this.getLowestServer(pServers)[0];
		return highest == lowest;
	}

	getMaxRamForAllServers = (maxServers, money) => {
		for (var i = 1; i <= 20; i++) {
			var cost = this.ns.getPurchasedServerCost(Math.pow(2, i))
			if (money < cost*maxServers)
				return i-1
		}
		return 20;
	}

	killDeletePurchase = (oldName, newRam) => {
		this.ns.print(`Killing ${oldName} to purchase new one with ${newRam} ram.`)
		if(this.ns.serverExists(oldName)){
			this.ns.killall(oldName)
			this.ns.deleteServer(oldName)
		}		
		this.ns.purchaseServer(`pserv-${newRam}`, newRam);
	}

	/* If all are same ram, check what level they can ALL be upgraded to, 
		then check how many you can upgrade to the next level with the left over money
		T = serverLimit
		li = servers upgraded to max ALL level
		ln = servers upgraded to next level
		T = li + ln, and Money = li*Pi + ln*Pn
		ln = (M-Pi*T)/(Pn-Pi), li = T - ln
	
	upgradeWhenAtSameLevel = (servers, currentMoney, serverLimit) => {
		var maxAllLevel = this.getMaxRamForAllServers(serverLimit, currentMoney)
		var maxAllLevelRam = Math.pow(2, maxAllLevel)
		var Pi = this.ns.getPurchasedServerCost(Math.pow(2, maxAllLevel))
		var Pn = this.ns.getPurchasedServerCost(Math.pow(2, maxAllLevel+1))
		var toUpgradeToHigher = Math.floor((currentMoney-Pi*serverLimit)/(Pn-Pi))
		var toUpgradeToLower = serverLimit - toUpgradeToHigher;
		var currentRam = this.serverUtils.getSizeFromName(servers[0])
		// If currentRam is the same as lower ram to upgrade to
		// we dont need to upgrade any to maxAllLevel			
		var i = 0;
		if(currentRam != maxAllLevelRam){
			for(; i < toUpgradeToLower; i++){
				this.killDeletePurchase(servers[i], maxAllLevelRam);
			}
		}
		var nextLevelRam = Math.pow(2, maxAllLevel+1)
		for(var j = i; j < toUpgradeToHigher + i; j++){
			this.killDeletePurchase(servers[j], nextLevelRam);
		}
	}
	*/

	buildUpgradeModels = (servers) => {
		var currentMoney = this.ns.getServerMoneyAvailable("home")
		var newLevels = servers.map(n => ({
			name: n,
			ram: this.serverUtils.getSizeFromName(n),
			cost: 0
		}));
		var serverLimit = this.ns.getPurchasedServerLimit()
		for(var i = 0; i < (serverLimit - servers.length); i++){
			newLevels.push({
				name: '',
				ram: 1,
				cost: 0
			})
		}
		var cost = 0;
		while(cost < currentMoney){
			this.mockUpgradeLowestServerOneLevel(newLevels)
			cost = 0;
			newLevels.forEach(n => cost+=n.cost) 
		}
		return newLevels;
	}

	mockUpgradeLowestServerOneLevel = (serverLevels) => {
		var lowest = serverLevels.reduce((a,b) => a.ram < b.ram ? a : b, serverLevels[0])
		lowest.ram = lowest.ram * 2;
		lowest.cost =  this.ns.getPurchasedServerCost(lowest.ram)
		// this.ns.print(`New cost after upgrade: ${lowest.cost }`)
	}

	/* If some servers are lower than others, 
	compute the cost of upgrading the lowest server, one level at a time
	until we would run out of money, then upgrade them.
	To keep track we will use an object with the name and the new ram
	*/
	upgradeWhenDifferentLevels = (servers) => {		
		//Go through the ones with a cost, those are the ones to upgrade
		var newLevels = this.buildUpgradeModels(servers)
		var toUpgrade = newLevels.filter(n => n.cost > 0);
		for(var serverLevel of toUpgrade){
			this.killDeletePurchase(serverLevel.name, serverLevel.ram)
		}
	}

	/** @param {NS} ns **/
	upgrade = async () => {		
		var servers = this.ns.getPurchasedServers();		
		var serverLimit = this.ns.getPurchasedServerLimit();
		this.upgradeWhenDifferentLevels(servers)
		//if(this.areAllServersSameRam(servers)){
		//	this.upgradeWhenAtSameLevel(servers, currentMoney, serverLimit)
		//} else {
		//	
		//}

		return await syncPurchased(this.ns)
	}

	getUpgradableCount = (servers) => {
		//Go through the ones with a cost, those are the ones to upgrade
		var newLevels = this.buildUpgradeModels(servers)
		var toUpgrade = newLevels.filter(n => n.cost > 0);
		return toUpgrade.length;
	}

	getBiggestNewServer = () => {
		var money = this.ns.getServerMoneyAvailable("home")
		var index = 0;
		for (var i = 1; i <= 20; i++) {
			var cost = this.ns.getPurchasedServerCost(Math.pow(2, i))
			if (money < cost){
				index = i-1
				break;
			}				
		}
		if(index == 0)
			index = 21
		return Math.pow(2,index);
	}

	purchaseAndSync = async (ram) => {
		this.ns.purchaseServer(`pserv-${ram}`, ram);
		return await syncPurchased(this.ns)
	}
}

export async function main(ns) {
	var upgradeUtils = new UpgradeUtils(ns)
	await upgradeUtils.upgrade();
}
/** @param {NS} ns **/
export function maxThreads(ns, server, script_ram){
	var avail_ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server)
	return Math.floor(avail_ram/script_ram)
}

/** @param {NS} ns **/
export function orderAttackersByMaxThread(ns, attackers, script){
	var sortedAttackers = []
	var script_ram = ns.getScriptRam(script)
	for(var attacker of attackers) {
		var index = null;
		var attackerMaxThreads = maxThreads(ns, attacker, script_ram)
		for(var i =0; i < sortedAttackers.length; i++){
			if(attackerMaxThreads < maxThreads(ns, sortedAttackers[i].attacker, script_ram)){
				index = i;
				break;
			}				
		}
		if(index == null)
			sortedAttackers.push({maxThreads:attackerMaxThreads, attacker: attacker})
		else
			sortedAttackers.splice(index, 0, {maxThreads:attackerMaxThreads, attacker: attacker})
	}
	return sortedAttackers;
}

/** @param {NS} ns **/
export function getThreadsForMaxMoney(ns, target) {
	return getThreadsForFractionMaxMoney(ns, target, 1)
}

// Grow rate is exponential with respects to threads (or threads are log to growth)
// so g(t) = 10^(bt), t(g) = log(g)/b
// T = t(10) = 1/b
// then if you want threads where g = M, t = logM/b=T*logM
export function getThreadsForFractionMaxMoney(ns, target, fraction) {
	var T = ns.growthAnalyze(target,10)
	var money_fraction = fraction*ns.getServerMaxMoney(target)/ns.getServerMoneyAvailable(target)
	return Math.max(0, Math.ceil(T*Math.log10(money_fraction)))
}

/** @param {NS} ns **/
export function getThreadsNeededForSecurityLevel(ns, target, level_above_min) {
	var b = ns.getServerSecurityLevel(target)
	var diff = b - (ns.getServerMinSecurityLevel(target) + level_above_min)
	var decrease_per_thread = 0.05
	return Math.max(0, Math.ceil(diff/decrease_per_thread))
}

/** @param {NS} ns **/
export function getThreadsNeededForHackingDownToFractionOfMax(ns, target, fraction_of_max) {
	var b = ns.hackAnalyze(target)
	var diff = (1 - fraction_of_max)/b
	return Math.max(0, Math.ceil(diff))
}

/** @param {NS} ns **/
export function getThreadsNeededToDecreaseSecurityToAboveMinThreshold(ns, target, threshold) {
	var levels = ns.getServerSecurityLevel(target) - (ns.getServerMinSecurityLevel(target) + threshold)
	return Math.max(0, Math.ceil(levels/0.002))
}
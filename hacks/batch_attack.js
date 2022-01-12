import {ServerUtils} from './utils/server_utils'
import {UpgradeUtils} from './utils/upgrade_utils'
import {maxThreads,
	getThreadsForMaxMoney,
	getThreadsNeededForSecurityLevel,
	getThreadsNeededForHackingDownToFractionOfMax,
	getThreadsForFractionMaxMoney,
	orderAttackersByMaxThread} from './utils/threads.js'


export class QueueItem {
	constructor(script, waitTime, threads, target, timesItem){
		this.script = script;
		this.waitTime = waitTime;
		this.threads = threads;
		this.target = target;
		this.timesItem = timesItem;
	}
}

export class Batch {
	constructor(grow, growWeaken, hack, weaken, timesItem){
		this.grow = grow;
		this.growWeaken = growWeaken
		this.hack = hack;
		this.weaken = weaken;
		this.timesItem = timesItem;
	}
}

export class TargetTimes {
	growTime = 0;
	weakenTime = 0;
	hackTime = 0;
	target = ''
}

/*
actAllThreadsForScript = (target, attackers, actionThreads, script) => {
		var gT = 0;		
		var scriptRam = this.ns.getScriptRam(script)
		for(var attacker of attackers) {
			var threads = maxThreads(this.ns, attacker, scriptRam)
			if(gT < actionThreads){
				var threadsToUse = Math.min(threads, actionThreads-gT)
				// this.ns.alert(`Threads to use for ${script}:${threadsToUse}`)
				if (threadsToUse > 0 && !this.ns.isRunning(script, attacker, target)){
					this.ns.exec(script, attacker, threadsToUse, target)					
					gT += threadsToUse
				}					
			}
			else
				break;
		}
	}

makeBatch = (target, timesItem, waitTime, threadInfo) => {
		var grow = new QueueItem('/hacks/grow.js', waitTime, threadInfo[0], target, timesItem)
		var growWeaken = new QueueItem('/hacks/weaken.js', waitTime, threadInfo[1], target, timesItem)
		var hack = new QueueItem('/hacks/hack.js', waitTime + timesItem.weakenTime, threadInfo[2], target, timesItem)
		var weaken = new QueueItem('/hacks/weaken.js', waitTime + timesItem.hackTime, threadInfo[3], target, timesItem)
		weaken.triggerNewBatch = true;
		return new Batch(grow, growWeaken, hack, weaken, timesItem)
	}

prepQueue = async (targets, attackers) => {
		var queue = []
		targets
			.map(n => ({target: n, batch: this.makeFirstBatch(n)}))
			.forEach( ({target, batch}) => {
				this.scheduleBatchInQueue(batch, queue, true);				
				var initialWeakenT = getThreadsNeededForSecurityLevel(this.ns, target, 0) 
				if(initialWeakenT > 0){
					var initialWeaken = new QueueItem('/hacks/weaken.js', 0, initialWeakenT, target, batch.timesItem)
					this.insertInQueue(queue, initialWeaken)
				}
			})
		var times = queue
			.filter(n => n.threads > 0)
			.map(a => Math.max(a.timesItem.weakenTime,a.timesItem.growTime));
		var max = times.length > 0 ?times.reduce((a,b) => {
			return a > b ? a:b;
		}) : 0;
		await this.workQueue(queue, attackers)
		
		return max;
	}
	
attack = async (targets) => {
	var queue = []
	if(this.usePrep){
		var attackers = this.ns.getPurchasedServers()
		var waitTime = await this.prepQueue(targets, attackers)
		this.ns.print(`Waiting for ${waitTime/1000/60} minutes after prep`);
		if(waitTime > 0){		
			await this.ns.sleep(waitTime)
		}
	}		
		
	while(true){		
		var attackers = this.ns.getPurchasedServers()
		targets
			.map(n => this.makeFirstBatch(n))
			.forEach(n => this.scheduleBatchInQueue(n, queue))
		
		await this.workQueue(queue, attackers)
	}	
}
*/

export class BatchAttacker {
	constructor(ns) {
        this.ns = ns;
		this.serverUtils = new ServerUtils(ns)
		this.upgradeUtils = new UpgradeUtils(ns)
		this.maxMoneyPercent = 0.4
		this.minSecurityThreshhold = 5
		this.purchaseServersTime = 10
		this.groupsPerScript = 4
		this.useSplitScript = true;
		this.usePrep = true;
		this.batchInterval = 400
		this.actionInterval = 100
		this.upgradeServersCount = 25
		this.canUpgrade = true;
    }

	/** @param {NS} ns **/
	execWithAlerts = (script, attacker, threadsToUse, target) => {
		if(!this.ns.serverExists(attacker)){
			this.ns.alert(`Cannot run ${script} from ${attacker} because it doesn't exist`)
		} else if(!this.ns.serverExists(target)){
			this.ns.alert(`Cannot run ${script} at ${target} because it doesn't exist`)
		} else {
			var maxAttackerThreads = maxThreads(this.ns, attacker, this.ns.getScriptRam(script))
			if(maxAttackerThreads < threadsToUse){
				this.ns.print(`Cannot run ${script} with ${threadsToUse} threads from ${attacker} because it has 
					${maxAttackerThreads} max threads. Will run with ${maxAttackerThreads}`)
				this.ns.exec(script, attacker, maxAttackerThreads, target)
			} else {
				this.ns.exec(script, attacker, threadsToUse, target)
			}
		} 
	}

	// TODO: Fix issue where list of good attackers is more than the ones we actually use
	// Possible fix: get the last attackers from the list, with should have the highest threads
	actSplitThreadsForScript = (script, attackers, threads, target) => {
		var scriptRam = this.ns.getScriptRam(script)
		var goodAttackers = attackers
			.filter(n => !this.ns.isRunning(script, n, target))	
			.filter(n => maxThreads(this.ns, n, scriptRam) > 0)		
		var maxGroups = Math.min(goodAttackers.length, this.groupsPerScript)
		goodAttackers = goodAttackers.slice(goodAttackers.length - maxGroups, goodAttackers.length)
		if(goodAttackers.length <= 0)	
			return;
		var maxThreadList = goodAttackers.map(n => maxThreads(this.ns, n, scriptRam));
		var maxThreadsToUse = maxThreadList.reduce((a,b) => a + b)
		// this.ns.alert(threads)
		threads = Math.min(maxThreadsToUse, threads)
		var rem = threads % maxGroups
		var threadsPerGroup = (threads - rem)/maxGroups;
		if(threadsPerGroup == 0)
			return;
		// Pick different attacker each time
		// For all except last, use run the integer amount of threads/groups
		// Sort attackers by max thread from low to high. 
		var sortedAttackers = orderAttackersByMaxThread(this.ns, goodAttackers, script)
		var leftoverThreads = 0
		for(var i = 0; i < maxGroups-1; i++){
			var attacker = sortedAttackers[i]			
			// If a lower attacker cant run all
			// the group threads, try them on the next attackers. 
			var threadsToUse = threadsPerGroup;
			if(threadsPerGroup > sortedAttackers[i].maxThreads){
				threadsToUse = Math.min(threadsPerGroup, sortedAttackers[i].maxThreads)
				leftoverThreads += (threadsPerGroup - threadsToUse)
			} else {
				threadsToUse = Math.min(sortedAttackers[i].maxThreads, threadsPerGroup + leftoverThreads)
				leftoverThreads -= (threadsToUse - threadsPerGroup)
			}

			this.execWithAlerts(script, sortedAttackers[i].attacker, threadsToUse, target)
		}
		// For the last one, add in remainder and leftover threads
		// From maxThreadList above,
		// we know all threads can be run by the group as a whole
		var attacker = sortedAttackers[maxGroups-1].attacker;
		this.execWithAlerts(script,attacker, rem + leftoverThreads + threadsPerGroup, target)
	}

	/** @param {NS} ns **/
	act = (target, attackers, actionThreads, script) => {
		this.actSplitThreadsForScript(script, attackers, actionThreads, target);
	}

	// 1. Find out how many threads needed to grow to max
	// 2. Find out how many threads needed to weaken to min
	// 3. Find out how many hacks needed to go over security threshhold or under money threshold
	// 1 and 2 run at the same time, while 3 runs after, so return only when total avail
	// threads is greater than both of them.
	/** @param {NS} ns **/
	getHackThreadsInfo = (target) => {	
		// grow threads needed to increase money to max	
		var maxMoneyT = getThreadsForMaxMoney(this.ns, target)
		// threads needed to lower security to compensate for grows
		var growWeakenT = Math.ceil(maxMoneyT*0.004/0.05)
		// threads needed for hacking to lower money to fraction of max
		var hackTMoney = getThreadsNeededForHackingDownToFractionOfMax(this.ns, target, this.maxMoneyPercent)
		// threads needed to lower security to compensate for hacks
		var hackWeakenT = Math.ceil(hackTMoney*0.002/0.05)
		
		return [maxMoneyT, growWeakenT, hackTMoney, hackWeakenT]
	}

	getTotalThreads = (attackers) => {
		var maxScriptRam = Math.max(
			this.ns.getScriptRam('/hacks/hack.js'), 
			this.ns.getScriptRam('/hacks/grow.js'),
			this.ns.getScriptRam('/hacks/weaken.js'))
		var threads = attackers.map(n => maxThreads(this.ns, n, maxScriptRam))
		var totalThreads = threads.reduce((a,b) => a+b);
		return totalThreads
	}

	getTimes = (target) => {
		return [this.ns.getGrowTime(target), this.ns.getWeakenTime(target), this.ns.getHackTime(target)]
	}

	makeTimesItem = (target) => {		
		var timesItem = new TargetTimes();
		var times = this.getTimes(target);
		timesItem.target = target;
		timesItem.growTime = times[0]
		timesItem.weakenTime = times[1]
		timesItem.hackTime = times[2]
		return timesItem;
	}

	makeBatchV2 = (target, timesItem, waitTime, threadInfo) => {
		var grow = new QueueItem('/hacks/grow.js', waitTime, threadInfo[0], target, timesItem)

		var growWeakenStart = Math.max(0, timesItem.growTime - timesItem.weakenTime) + this.actionInterval;
		var growWeaken = new QueueItem('/hacks/weaken.js',waitTime +  growWeakenStart, threadInfo[1], target, timesItem);

		var hackStart = Math.max(0, timesItem.growTime - timesItem.hackTime) + this.actionInterval
		var hack = new QueueItem('/hacks/hack.js', waitTime + hackStart, threadInfo[2], target, timesItem);

		var weakenStart = Math.max(0, timesItem.growTime - timesItem.weakenTime) + this.actionInterval;
		var weaken = new QueueItem('/hacks/weaken.js', waitTime + weakenStart, threadInfo[3], target, timesItem)
		weaken.triggerNewBatch = true;

		return new Batch(grow, growWeaken, hack, weaken, timesItem)
	}

	makeFirstBatch = (target, waitTime=0) => {
		var threadInfo = this.getHackThreadsInfo(target)
		var timesItem = this.makeTimesItem(target)
		var initialBatch = this.makeBatchV2(target, timesItem, waitTime, threadInfo)
		
		return initialBatch;
	}

	insertInQueue(queue, item){
		var index = -1;
		for(var i = 0;i < queue.length; i++){
			if(queue[i].waitTime < item.waitTime){
				index = i;
				break;
			}				
		}
		if(index == -1)
			index = queue.length;
		queue.splice(index, 0, item)
	}

	scheduleBatchInQueue = (batch, queue) => {
		this.insertInQueue(queue, batch.grow)
		this.insertInQueue(queue, batch.growWeaken)
		this.insertInQueue(queue, batch.hack)
		this.insertInQueue(queue, batch.weaken)
	}

	resetQueue = (waitedTime, queue) => {
		for(var item of queue){
			item.waitTime -= waitedTime
		}
	}

	alertQueue = (queue) => {
		var grows = queue.filter(n => n.script == '/hacks/grow.js')
		var growWeakens = queue.filter(n => n.script == '/hacks/weaken.js' && n.triggerNewBatch)
		var hacks = queue.filter(n => n.script == '/hacks/hack.js')
		var weakens = queue.filter(n => n.script == '/hacks/weaken.js' && !n.triggerNewBatch)

		var growTimes = grows.map(n => Math.ceil(n.waitTime/1000)).join(',')
		var growWeakenTimes = growWeakens.map(n => Math.ceil(n.waitTime/1000)).join(',')
		var hackTimes = hacks.map(n => Math.ceil(n.waitTime/1000)).join(',')
		var weakenTimes = weakens.map(n => Math.ceil(n.waitTime/1000)).join(',')
		this.ns.print(`-----------------------------`)
		this.ns.print(`G:${growTimes}\r\nGW:${growWeakenTimes}\r\nH:${hackTimes}\r\nW:${weakenTimes}`)
		this.ns.print(`-----------------------------`)
	}	

	/*
	Process queue items. 
	Items should be sorted with the ones with lowest waitTime at the end,
	which is the TOTAL amount of time it needed to wait before triggering,
	so keep track of total time that has been waited (waitedTime) and subtract it 
	from the item's wait time to find how much is left to wait, then increment waitedTime.
	When an item is set to trigger new batch, recalculate times and threads,
	and add batchOffset to its waitTime so all its items will use that to calculate when to start
	*/
	workQueue = async (queue, attackers, targets) => {
		var waitedTime = 0;
		var waitingForUpgrade = false;
		//use this to know when it's safe to kill scripts in servers 
		//so we can upgrade. It should be the last finish time of all
		//items processed.
		var upgradeWaitTime = 0;
		while(queue.length > 0){
			var queueItem = queue.pop()
			// this.alertQueue(queue)
			this.ns.print(`--------------Queue Items: ${queue.length}--------------`)

			// Find how much is left to wait for this item and wait it, then update waitedItem
			var waitTime = queueItem.waitTime - waitedTime
			if(waitTime > 0){
				await this.ns.sleep(waitTime)
				waitedTime += waitTime;				
			}

			//Make new batch with updated values, unless we're winding down queue for an upgrade
			//Only the weakenHack items in a batch should have triggerNewBatch turned on
			if(queueItem.triggerNewBatch && !waitingForUpgrade){
				var threadInfo = this.getHackThreadsInfo(queueItem.target)
				this.ns.print(`----Making new batch with wait time:${queueItem.waitTime}----`)
				// We want batches separated by *at least* batchInterval ms
				// When growTime > weakenTime, we want to start next batch a right after the grow finishes,
				// since everything in the current batch will finish right after its grow finishes
				// When weakenTime > growTime, we want to start after the weaken, so everything
				// from current batch is finished by the time anything from the next batch finishes
				var batchOffset = Math.max(this.batchInterval,
					Math.max(0, queueItem.timesItem.weakenTime - queueItem.timesItem.growTime))
				var newBatch = this.makeBatchV2(
					queueItem.target, 
					queueItem.timesItem, 
					queueItem.waitTime + batchOffset,
					threadInfo)
				this.scheduleBatchInQueue(newBatch, queue)
				//Update if new batch has items finishing after current upgradeWaitTime
				upgradeWaitTime = Math.max(upgradeWaitTime, queueItem.waitTime + batchOffset + 
					Math.max(queueItem.timesItem.weakenTime, queueItem.timesItem.growTime))
				// await this.ns.sleep(5000)
			}
			
			// process current queue item
			this.act(queueItem.target, attackers, queueItem.threads, queueItem.script);

			// See if we can upgrade some servers
			var upgradableServers = this.upgradeUtils.getUpgradableCount(this.ns.getPurchasedServers());
			if(upgradableServers >= this.upgradeServersCount && !waitingForUpgrade && this.canUpgrade){
				this.ns.print(`------------Can purchase ${upgradableServers} new servers-------------`)
				waitingForUpgrade = true
			}

			//Queue is empty, do upgrades and restart queue
			if(waitingForUpgrade && queue.length == 0){
				//Sleep until all batch items have finished
				upgradeWaitTime -= waitedTime;
				if(upgradeWaitTime > 0){
					await this.ns.sleep(upgradeWaitTime+this.actionInterval)
				}
				await this.upgradeUtils.upgrade();
				attackers = this.ns.getPurchasedServers()
				waitedTime = 0
				upgradeWaitTime = 0
				waitingForUpgrade = false
				targets
				.forEach(target => {
					var firstWorkBatch = this.makeFirstBatch(target, 0);
					this.scheduleBatchInQueue(firstWorkBatch, queue);
				})
			}
		}
	}

	//Insert items into queue that bring money up to startMaxMoneyFraction, and security down to min
	insertPrepQueueItems = (queue, target) => {
		var timesItem = this.makeTimesItem(target)
		var initialWeakenT = getThreadsNeededForSecurityLevel(this.ns, target, 0) 
		if(initialWeakenT > 0){
			var initialWeaken = new QueueItem('/hacks/weaken.js', 0, initialWeakenT, target, timesItem)
			this.insertInQueue(queue, initialWeaken)
		}
		var initialGrowT = getThreadsForFractionMaxMoney(this.ns, target, this.startMaxMoneyFraction)
		if(initialGrowT > 0){
			var initialGrow = new QueueItem('/hacks/grow.js', 0, initialGrowT, target, timesItem)
			this.insertInQueue(queue, initialGrow)
			var growWeakenT = Math.ceil(initialGrowT*0.004/0.05)
			if(growWeakenT > 0){
				var growWeaken = new QueueItem('/hacks/weaken.js', 0, growWeakenT, target, timesItem)
				this.insertInQueue(queue, growWeaken)
			}			
		}
		return timesItem;
	}

	//Add queue items to prep targets for money and security
	//then add first batches to each target, and start processing queue
	prepAndWorkQueue = async (targets, attackers) => {
		var queue = []
		targets
			.forEach( target => {		
				var timesItem = this.insertPrepQueueItems(queue, target)			
				var waitTimeBeforeAttack = Math.max(timesItem.weakenTime,timesItem.growTime)+this.actionInterval;
				var firstWorkBatch = this.makeFirstBatch(target, waitTimeBeforeAttack);
				this.scheduleBatchInQueue(firstWorkBatch, queue);
			})
		await this.workQueue(queue, attackers, targets)
	}	
	
	attackV2 = async (targets) => {
		while(true){		
			// var upgradableServers = this.upgradeUtils.getUpgradableCount(this.ns.getPurchasedServers());
			// if(upgradableServers >= this.upgradeServersCount)
			// 	await this.upgradeUtils.upgrade()
			var attackers = this.ns.getPurchasedServers()			
			await this.prepAndWorkQueue(targets, attackers)
		}	
	}
}

export class Optimizer {
	constructor(ns) {
        this.ns = ns;
		this.attacker = new BatchAttacker(ns)
		this.startMaxMoneyFraction = 0.8;
		this.minThreadsFraction = 0.1;
		this.moneyFractionStep = 0.05;
    }

	optimize(){

	}
}

/** @param {NS} ns **/
export async function main(ns) {
	var targetLimit = null;
	if(ns.args.length > 0)
		targetLimit = ns.args[0]
	var attacker = new BatchAttacker(ns);
	attacker.canUpgrade = false;
	var serverUtils = new ServerUtils(ns)
	//Crack all servers that you have enough programs to crack before hacking
	var level = serverUtils.getCrackLevel()
	serverUtils.openHosts(level)
	var targets = serverUtils.getHackableExistingServers(level)
	if(targetLimit)
		targets = targets.slice(0, targetLimit)
	await attacker.attackV2(targets)
}
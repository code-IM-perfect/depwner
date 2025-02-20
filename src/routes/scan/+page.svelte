<script lang="ts">
	let settings = $state({
		yara: true,
		locations: ['/home/harshit/Harshit_Work/']
	});
	let hashDatabases = $derived(
		settings.yara
			? [
					'Malpedia',
					'EmbeeResearch',
					'Microsoft',
					'AvastTI',
					'Arkbird SOLG',
					'Signature Base',
					'Elastic',
					'CadoSecurity'
				]
			: ['Malpedia', 'EmbeeResearch', 'Microsoft', 'AvastTI']
	);
	let yaraDatabases = $derived(
		settings.yara
			? [
					'Malpedia',
					'Dragon Threat Labs',
					'Microsoft',
					'FireEye-RT',
					'RussianPanda',
					'GodModeRules'
				]
			: ['Dragon Threat Labs', 'Microsoft']
	);

	let status = $state({
		status: 'idle',
		type: 'full',
		progress: 82,
		threatsFound: 2,
		filesToScan: 100,
		currentFile:
			'/home/harshit/Videos/Gravity Falls/Gravity Falls Season 1 WEB-HD 720p x264 [Pahe.in]/Gravity.Falls.S01E01.720p.WEB-HD.x264.150MB-Pahe.in.mkv'
	});
	onMount(async () => {
		const statusObj = depwnerStatus.getScanStatus();
		status = JSON.parse(statusObj);

		let settingsResponse = await depwnerPreferences.get();
		settings = JSON.parse(settingsResponse);
		console.log(settingsResponse);
	});

	let interval = $state(15000);
	$effect(() => {
		console.log('Effect called');
		console.log(status);

		const updateStatus = setInterval(async () => {
			if (JSON.parse(JSON.stringify(status)).status == 'scan') {
				interval = 1000;
			} else {
				interval = 15000;
			}
			const statusObj = await depwnerStatus.getScanStatus();
			status = JSON.parse(statusObj);
		}, interval);
	});

	import FullScan from '../../components/+FullScan.svelte';
	import CustomScan from '../../components/+CustomScan.svelte';
	import { RefreshCcw } from 'lucide-svelte';
	import { onMount } from 'svelte';
</script>

<div class="mainCont grid text-center {status.status == 'scan' ? 'scanning' : ''}">
	{#if status.status == 'scan'}
		<div class="scanPannel row-span-2">
			<div>
				{#if status.type == 'full'}
					<h1 class="flex items-center justify-center gap-2">Full Scan in Progress</h1>
					{#each settings.locations as location}
						<p>{location}</p>
					{/each}
				{:else if status.type == 'custom'}
					<h1 class="flex items-center justify-center gap-2">Custom Scan in Progress</h1>
				{/if}
				<div class="flex justify-center">
					<div class="spin h-min w-min">
						<RefreshCcw size="min(10vh,10vw)" />
					</div>
				</div>
			</div>
		</div>
	{:else}
		<button
			class="scanButton row-start-1"
			onclick={() => {
				status.status = 'full';
			}}
		>
			<div>
				<h2>Full System Scan</h2>
				<p>Scan all the files on the monitored filesystem paths</p>
			</div>
		</button>
		<button
			class="scanButton row-start-2"
			onclick={() => {
				status.status = 'custom';
			}}
		>
			<div>
				<h2>Custom Scan</h2>
				<p>Scan a particular File or Folder</p>
			</div>
		</button>
	{/if}
	<div class="statusPannel row-span-2">
		<!-- <button class="lastReportButton">Last Scan Report</button> -->
		<h3>Active Hash Datasets</h3>
		<div class="grid place-items-center">
			<div>
				{#each hashDatabases as hashDatabase}
					<div class="entry flex items-center justify-end">
						<p><span class="font-bold">{hashDatabase}</span>&nbsp;&nbsp;Active</p>
						<div class="pinger relative">
							<div class="pinger animate-ping-monitoring absolute"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
		<h3 class="mt-[2vh]">Active Yara Datasets</h3>
		<div class="grid place-items-center">
			<div>
				{#each yaraDatabases as yaraDatabase}
					<div class="entry flex items-center justify-end">
						<p><span class="font-bold">{yaraDatabase}</span>&nbsp;&nbsp;Active</p>
						<div class="pinger relative">
							<div class="pinger animate-ping-monitoring absolute"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
{#if status.status == 'full'}
	<FullScan bind:option={status.status} />
	<button
		aria-label="close popup"
		onclick={() => {
			status.status = 'idle';
		}}
		class="absolute left-0 top-0 z-10 h-[100vh] w-[100vw] bg-black opacity-60"
	></button>
{:else if status.status == 'custom'}
	<CustomScan bind:option={status.status} />
	<button
		aria-label="close popup"
		onclick={() => {
			status.status = 'idle';
		}}
		class="absolute left-0 top-0 z-10 h-[100vh] w-[100vw] bg-black opacity-60"
	></button>
{/if}

<style>
	/* .progressBar { */
	/* 	display: flex; */
	/* 	align-items: center; */
	/* 	gap: 0.7vw; */
	/* 	transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1); */
	/* 	.progressBack { */
	/* 		width: stretch; */
	/* 		background: repeating-linear-gradient( */
	/* 				135deg, */
	/* 				rgb(var(--ctp-surface0)) 0 1vh, */
	/* 				rgb(var(--ctp-surface2)) 0 2vh */
	/* 			) */
	/* 			0/100%; */
	/* 		border-radius: 0.5vh; */
	/* 		height: min(1.6vh, 1.6vw); */
	/* 		transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1); */
	/* 	} */
	/* 	.progress { */
	/* 		background: repeating-linear-gradient(135deg, #658ce6 0 1vh, rgb(var(--ctp-blue)) 0 2vh) */
	/* 			0/100% no-repeat; */
	/* 		left: 0; */
	/* 		right: 50%; */
	/* 	} */
	/* } */
	/* .statusData { */
	/* 	width: 40vw; */
	/* 	display: flex; */
	/* 	.value { */
	/* 		text-overflow: ellipsis; */
	/* 		overflow: hidden; */
	/* 		text-wrap: nowrap; */
	/* 		overflow-wrap: break-word; */
	/* 	} */
	/* } */
	@keyframes spin {
		to {
			transform: rotate(-360deg);
		}
	}
	.spin {
		animation: spin 1.5s linear infinite;
	}
	.scanPannel {
		width: 100%;
		background: rgb(var(--ctp-base));
		border-radius: 1.5vh;
		display: grid;
		place-items: center;
	}
	h1 {
		font-size: min(3.5vh, 3.5vw);
		font-weight: 800;
	}
	.entry {
		margin: 0.5vh 0;
	}
	.mainCont {
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
		gap: min(2vh, 2vw);
	}
	.mainCont.scanning {
		grid-template-columns: 1.5fr 0.5fr;
		.statusPannel {
			width: max-content;
			padding: 5vh 6vw;
		}
		h3 {
			font-size: min(3vh, 2.5vw);
			font-weight: 700;
		}
		p {
			font-size: min(1.8vh, 1.8vw);
		}
	}
	.scanButton {
		background: rgb(var(--ctp-base));
		border-radius: 1.5vh;
		display: grid;
		place-items: center;
		h2 {
			font-size: min(4vh, 2.5vw);
			font-weight: 700;
		}
		div {
			max-width: 30vw;
		}
		transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
	}
	.scanButton:hover {
		background: rgba(var(--ctp-surface0));
	}
	.statusPannel {
		border-radius: 1.5vh;
		padding: min(7vh, 7vw) 0;
		background: rgb(var(--ctp-base));
		width: 35vw;
		h3 {
			font-size: min(4vh, 2.5vw);
			font-weight: 700;
		}
		p {
			font-size: min(2vh, 1.8vw);
		}
	}

	.pinger {
		display: block;
		--size: min(1.2vh, 1.2vw);
		height: var(--size);
		width: var(--size);
		background: oklch(0.897 0.196 126.665);
		border-radius: 50%;
		margin-left: 0.5vw;
	}
	.animate-ping-monitoring {
		right: 0;
		left: 0;
		margin: auto;
		animation: ping-monitor 2s cubic-bezier(0, 0, 0.2, 1) infinite;
	}
	@keyframes ping-monitor {
		50%,
		100% {
			transform: scale(2.2);
			opacity: 0;
		}
	}
</style>

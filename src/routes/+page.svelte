<script lang="ts">
	import HomeButton from '../components/+HomeButton.svelte';
	import { onMount } from 'svelte';

	import {
		RefreshCcw,
		ShieldIcon,
		ChartSpline,
		FileTextIcon,
		ShieldCheckIcon,
		ShieldXIcon,
		CalendarClockIcon,
		ShieldAlertIcon
	} from 'lucide-svelte';

	const statusMessages = {
		Okay: {
			title: 'Secure',
			message:
				'No Threats were found.<br/><span class="text-lime-300">All Services are Active</span>',
			fix: '',
			link: '',
			icon: ShieldCheckIcon,
			backIcon: ShieldIcon,
			color: 'oklch(0.897 0.196 126.665)'
		},
		Threat: {
			title: 'Threat Detected',
			message: 'Threats were Detected.<br/>Detected Threats Quarantined',
			fix: 'Take action now',
			link: 'threats.html',
			icon: ShieldXIcon,
			backIcon: ShieldIcon,
			color: 'rgb(var(--ctp-red))'
		},
		// Disabled: {
		// 	title: 'DePWNer is Disabled',
		// 	message: '',
		// 	fix: 'Enable now',
		// 	link: 'settings.html',
		// 	icon: ShieldXIcon,
		// 	backIcon: ShieldIcon,
		// 	color: 'catp-red'
		// },
		NoSchedule: {
			title: 'Feature Disabled',
			message: 'Scheduled Scanning was disabled',
			fix: 'Enable Now',
			link: 'schedule.html',
			icon: ShieldAlertIcon,
			backIcon: ShieldIcon,
			color: 'rgb(var(--ctp-yellow))'
		},
		LocationsEmpty: {
			title: 'No Locations Set',
			message:
				"No locations are being monitiored<br/><span class='text-catp-peach'>Please add at least one location to monitor</span>",
			fix: 'Add Now',
			link: 'settings.html',
			icon: ShieldAlertIcon,
			backIcon: ShieldIcon,
			color: 'rgb(var(--ctp-peach))'
		},
		YaraDisabled: {
			title: 'Secure',
			message:
				'No Threats were found.<br/><span class="text-catp-peach">Advanced Database is Disabled though</span>',
			fix: 'Enable Now',
			link: 'settings.html',
			icon: ShieldCheckIcon,
			backIcon: ShieldIcon,
			color: 'oklch(0.897 0.196 126.665)'
		}
		// FeatureDisabled: {
		// 	title: 'Features Disabled',
		// 	message: 'Some Security features were disabled',
		// 	fix: 'Enable them now',
		// 	link: '/settings',
		// 	icon: ShieldXIcon,
		// 	backIcon: ShieldIcon,
		// 	color: ''
		// }
	};

	// let settings = $state();
	let settings;
	let threats = $state(0);
	onMount(async () => {
		const settingsResponse = await depwnerPreferences.get();
		settings = JSON.parse(settingsResponse);
		console.log(settingsResponse)
		const threatResponse = await depwnerStatus.getThreats();
		const threatArr = JSON.parse(threatResponse);
		threats = threatArr.length;
	});

	let dashStatus = $derived.by(() => {
		if (threats != 0) {
			return statusMessages.Threat;
		} else if (!settings.locations[0]) {
			return statusMessages.LocationsEmpty;
		} else if (!settings.schedule.active) {
			return statusMessages.NoSchedule;
		} else if (!settings.yara) {
			return statusMessages.YaraDisabled;
		} else {
			return statusMessages.Okay;
		}
	});
</script>

<div class="dashContainer grid grid-cols-4 text-center">
	<HomeButton href="scan.html">
		<RefreshCcw />
		<h3>Start a Scan</h3>
	</HomeButton>
	<HomeButton href="stats.html">
		<ChartSpline />
		<h3>Statistics</h3>
	</HomeButton>
	<HomeButton href="logs.html">
		<FileTextIcon />
		<h3>Scan Reports</h3>
	</HomeButton>
	<HomeButton href="schedule.html">
		<CalendarClockIcon />
		<h3>Scan Schedule</h3>
	</HomeButton>
	<div
		class="homeStatusCard card col-start-3 col-end-5 row-start-1 row-end-3 grid place-items-center rounded-[2vh] bg-catp-mantle"
		style="--statusColor: {dashStatus.color}"
	>
		<div class="cardInner grid justify-items-center">
			<div style="color:var(--statusColor)">
				<p class="relative">
					<dashStatus.icon />
					<dashStatus.backIcon class="animate-ping-shield absolute top-0" />
				</p>
				<h3 class="relative">
					{dashStatus.title}
				</h3>
			</div>
			<p>{@html dashStatus.message}</p>
			{#if dashStatus.fix}
				<a
					class="fix my-[1vh] rounded-[0.5vh] bg-catp-surface0/60 px-[1vh] py-[0.2vh]"
					href={dashStatus.link}>{dashStatus.fix}</a
				>
			{/if}
			<div class="statusButtons">
				<a href="settings.html" class="statusCardList">
					<p>Active Monitoring</p>
					<div class="flex items-center" style="--pingColor:oklch(0.897 0.196 126.665)">
						<p>{settings.yara ? 'Active' : 'Disabled'}</p>
						<div class="yara_ping relative">
							<div class="yara_ping animate-ping-monitoring absolute"></div>
						</div>
					</div>
				</a>

				<a href="threats.html" class="statusCardList">
					<p>Last Scan</p>
					<div class="flex">
						<p>3 days ago</p>
					</div>
				</a>
			</div>
		</div>
	</div>
</div>

<style>
	.yara_ping {
		--size: min(1.5vh, 1.5vw);
		height: var(--size);
		width: var(--size);
		background: var(--pingColor);
		border-radius: 50%;
		margin-left: 0.5vw;
	}
	.animate-ping-monitoring {
		right: 0;
		left: 0;
		margin: auto;
		animation: ping-monitor 2s cubic-bezier(0, 0, 0.2, 1) infinite;
	}
	.statusButtons {
		width: min(35vh, 28vw);
		margin: min(1vh, 1vw) 0;
	}
	.statusCardList {
		display: flex;
		justify-content: space-between;
		background: rgba(var(--ctp-surface0), 40%);
		padding: min(1vh, 1vw) min(2vh, 2vw);
		margin: min(1vh, 1vw) 0;
		border-radius: 1vh;
		transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
	}
	.statusCardList:hover {
		background: rgb(var(--ctp-surface0));
	}
	.dashContainer {
		gap: min(2vh, 1.5vw);
	}
	.homeStatusCard {
		transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
		padding: min(5vh, 4vw);
		h3 {
			font-size: min(4vh, 3vw);
			font-weight: 700;
			margin-top: -0.5vh;
		}
		p,
		a.fix {
			font-size: min(1.6vh, 1.5vw);
			max-width: 30vw;
			transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
		}
		a.fix {
			color: var(--statusColor);
		}
		a.fix:hover {
			color: rgb(var(--ctp-crust));
			background: var(--statusColor);
		}
	}
	.homeStatusCard p :global(.lucide-icon) {
		height: min(15vh, 12vw);
		width: stretch;
	}
	@keyframes ping {
		50%,
		100% {
			transform: scale(1.35);
			opacity: 0;
		}
	}
	@keyframes ping-monitor {
		50%,
		100% {
			transform: scale(1.7);
			opacity: 0;
		}
	}
	:global(.animate-ping-shield) {
		animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
	}
</style>

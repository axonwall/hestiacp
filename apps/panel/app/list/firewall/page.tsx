import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView, sortByIp } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { bulkFirewallAction, moveFirewallRuleAction, toggleFirewallRuleAction } from "./actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
	const session = await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listFirewallRules());
	const token = String(session.data.token ?? "");
	const { sort } = await searchParams;
	// PHP shows the move arrows only when the rule can actually move
	// (first rule has no Up, last has no Down); order is numeric rule order.
	const ruleKeys = ("error" in result ? [] : Object.keys(result.rows)).sort(
		(a, b) => Number(a) - Number(b) || a.localeCompare(b),
	);
	const firstRule = ruleKeys[0];
	const lastRule = ruleKeys[ruleKeys.length - 1];
	const moveForm = (rule: string, direction: string, title: string, icon: string) => (
		<form action={moveFirewallRuleAction} style={{ display: "inline" }}>
			<input type="hidden" name="token" value={token} />
			<input type="hidden" name="rule" value={rule} />
			<input type="hidden" name="direction" value={direction} />
			<RowActionButton title={title} icon={icon} />
		</form>
	);
	return (
		<ListView
			title={t("Firewall")}
			result={result}
			columns={[
				{ key: "RULE", label: t("Pos") },
				{
					key: "ACTION",
					label: t("Action"),
					heading: true,
					format: (v, row, key) => {
						const drop = v === "DROP";
						const icon = drop ? "fa-circle-minus" : "fa-circle-check";
						const color = row.SUSPENDED === "yes" ? "" : drop ? " icon-red" : " icon-green";
						return (
							<a href={`/edit/firewall?rule=${encodeURIComponent(key)}`}>
								<i className={`fas ${icon} u-mr5${color}`}></i> {v}
							</a>
						);
					},
				},
				{
					key: "COMMENT",
					label: t("Comment"),
					format: (v) => <span className="u-text-bold">{v}</span>,
				},
				{ key: "PROTOCOL", label: t("Protocol"), center: true },
				{
					key: "PORT",
					label: t("Port"),
					center: true,
					format: (v) => <span className="u-text-bold">{v}</span>,
				},
				{ key: "IP", label: t("IP Address"), center: true },
			]}
			rowHref={(key) => `/edit/firewall?rule=${encodeURIComponent(key)}`}
			rowActions={(key, row) => [
				...(key !== firstRule
					? [moveForm(key, "up", t("Move Firewall Rule Up"), "fa-arrow-up icon-blue")]
					: []),
				...(key !== lastRule
					? [moveForm(key, "down", t("Move Firewall Rule Down"), "fa-arrow-down icon-blue")]
					: []),
				<RowAction
					href={`/edit/firewall?rule=${encodeURIComponent(key)}`}
					title={t("Edit Firewall Rule")}
					icon="fa-pencil icon-orange"
				/>,
				<form action={toggleFirewallRuleAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="rule" value={key} />
					<input
						type="hidden"
						name="op"
						value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"}
					/>
					<RowActionButton
						title={row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}
						icon={row.SUSPENDED === "yes" ? "fa-play icon-green" : "fa-pause icon-highlight"}
					/>
				</form>,
				<RowAction
					href={`/delete/firewall?rule=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("firewall rule"), plural: t("firewall rules") }}
			checkboxName="rule[]"
			bulkAction={bulkFirewallAction}
			bulkToken={token}
			bulkOptions={[{ value: "delete", label: t("Delete") }]}
			sort={sort}
			sortBase="/list/firewall"
			sortOptions={[
				{
					key: "action",
					label: t("Action"),
					value: (_k, row) => row.ACTION ?? "",
					dir: "asc",
				},
				{
					key: "protocol",
					label: t("Protocol"),
					value: (_k, row) => row.PROTOCOL ?? "",
					dir: "asc",
				},
				{
					key: "port",
					label: t("Port"),
					value: (_k, row) => Number(String(row.PORT ?? "").split(",")[0]) || 0,
					dir: "asc",
				},
				{ key: "ip", label: t("IP Address"), value: sortByIp, dir: "asc" },
				{
					key: "comment",
					label: t("Comment"),
					value: (_k, row) => row.COMMENT ?? "",
					dir: "asc",
				},
			]}
			containerId="list-firewall"
			search={false}
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/list/server">
				<i className="fas fa-arrow-left icon-blue"></i>
				{t("Back")}
			</Link>
			<Link className="button button-secondary" href="/add/firewall">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Rule")}
			</Link>
			<Link className="button button-secondary" href="/list/firewall/banlist">
				{t("Banned IP Addresses")}
			</Link>
			<Link className="button button-secondary" href="/list/firewall/ipset">
				{t("IPset IP Lists")}
			</Link>
		</ListView>
	);
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CampaignListRow } from "@/lib/data/campaigns";
import { CampaignStatusBadge } from "./CampaignStatusBadge";

function dateCell(c: CampaignListRow): string {
  if (c.sentAt) return c.sentAt.slice(0, 10);
  if (c.scheduledAt) return `(예약) ${c.scheduledAt.slice(5, 10)}`;
  return "–";
}

export function CampaignsTable({ campaigns }: { campaigns: CampaignListRow[] }) {
  const router = useRouter();

  return (
    <table className="dlist">
      <thead>
        <tr>
          <th>제목</th>
          <th>세그먼트 요약</th>
          <th className="c">대상 수</th>
          <th>발송일</th>
          <th className="c">응답률</th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>
        {campaigns.map((c) => {
          // 임시저장은 집계가 없으므로 행 이동 없음 (마법사 이어쓰기는 Phase2)
          const clickable = c.status !== "draft";
          return (
            <tr
              key={c.id}
              className={clickable ? "row-clk" : undefined}
              onClick={
                clickable
                  ? () => router.push(`/app/campaigns/${c.id}`)
                  : undefined
              }
            >
              <td className="co">
                {clickable ? (
                  <Link
                    href={`/app/campaigns/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.title}
                  </Link>
                ) : (
                  c.title
                )}
              </td>
              <td>
                <span className="seg-chip">
                  {c.segmentSummary ?? "작성 중"}
                </span>
              </td>
              <td className="c num">
                {c.recipientCount !== null ? `${c.recipientCount}개사` : "–"}
              </td>
              <td className="date num">{dateCell(c)}</td>
              <td className="c">
                {c.responseRate !== null ? (
                  <span className="rate num">{c.responseRate}%</span>
                ) : (
                  <span className="cell-muted">–</span>
                )}
              </td>
              <td>
                <CampaignStatusBadge status={c.status} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

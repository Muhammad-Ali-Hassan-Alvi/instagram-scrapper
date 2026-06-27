import { formatDate, formatNumber } from "@/lib/format";
import type { DashboardPost } from "@/services/dashboard";

export function RecentPostsTable({ posts }: { posts: DashboardPost[] }) {
  if (!posts.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
        No posts yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Views</th>
              <th className="px-4 py-3 font-medium text-right">Likes</th>
              <th className="px-4 py-3 font-medium text-right">Comments</th>
              <th className="px-4 py-3 font-medium">Link</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-medium">@{post.username}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {formatDate(post.postedAt)}
                </td>
                <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-400">
                  {post.type}
                </td>
                <td className="px-4 py-3 text-right">{formatNumber(post.views)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(post.likes)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(post.comments)}</td>
                <td className="px-4 py-3">
                  {post.postUrl ? (
                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                    >
                      Open
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { loadLeaderboard } from '../../engine';
import { ScreenHeader } from '../components/Common';
import { LEVEL_NAME, SYSTEM_NAME, chapterName, fmtDate } from '../util';

export function Leaderboard() {
  const [entries] = useState(() => loadLeaderboard());
  return (
    <main className="screen">
      <ScreenHeader title="排行榜" />
      <section className="panel paper">
        {entries.length === 0 ? (
          <p className="center muted">暫無紀錄。到挑戰模式一展身手吧！</p>
        ) : (
          <div className="table-wrap">
            <table className="table leaderboard">
              <caption className="sr-only">本機排行榜前十名</caption>
              <thead>
                <tr>
                  <th scope="col">名次</th>
                  <th scope="col">名稱</th>
                  <th scope="col">分數</th>
                  <th scope="col">強度</th>
                  <th scope="col">系統</th>
                  <th scope="col">關卡</th>
                  <th scope="col">日期</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className={i < 3 ? `rank-${i + 1}` : undefined}>
                    <td className="rank">{i + 1}</td>
                    <td>{e.name}</td>
                    <td className="num">{e.score.toLocaleString()}</td>
                    <td>{LEVEL_NAME[e.level]}</td>
                    <td>{SYSTEM_NAME[e.system]}</td>
                    <td>{e.stage === 'endless' ? '無盡' : chapterName(e.stage)}</td>
                    <td className="small">{fmtDate(e.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

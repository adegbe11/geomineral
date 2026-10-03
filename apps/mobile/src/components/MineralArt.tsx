import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from "react-native-svg";
import type { Habit } from "../minerals";

// Lighten (amt > 0) or darken (amt < 0) a hex colour.
const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) =>
    Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt));
  const r = f(n >> 16),
    g = f((n >> 8) & 255),
    b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

/** Stylised specimen drawn from a mineral's colour and crystal habit. */
export default function MineralArt({
  color,
  habit = "massive",
  size = 52,
}: {
  color: string;
  habit?: Habit;
  size?: number;
}) {
  const l = shade(color, 0.35),
    ll = shade(color, 0.6),
    d = shade(color, -0.3),
    dd = shade(color, -0.5);
  let body;
  switch (habit) {
    case "cubic":
      body = (
        <G>
          <Polygon points="14,24 34,14 54,24 34,34" fill={l} />
          <Polygon points="14,24 34,34 34,56 14,46" fill={color} />
          <Polygon points="34,34 54,24 54,46 34,56" fill={d} />
          <Path d="M20 30v12M26 33v13M40 31v19M47 28v18" stroke={dd} strokeWidth={0.8} opacity={0.5} />
        </G>
      );
      break;
    case "octahedral":
      body = (
        <G>
          <Polygon points="32,6 12,32 32,40" fill={l} />
          <Polygon points="32,6 52,32 32,40" fill={color} />
          <Polygon points="12,32 32,58 32,40" fill={d} />
          <Polygon points="52,32 32,58 32,40" fill={dd} />
        </G>
      );
      break;
    case "prism":
      body = (
        <G>
          <Polygon points="20,18 26,10 32,18 32,54 20,54" fill={color} />
          <Polygon points="32,18 38,10 44,18 44,54 32,54" fill={d} />
          <Polygon points="20,18 26,10 38,10 44,18 32,18" fill={l} />
          <Path d="M24 22v28M28 22v28M36 22v28M40 22v28" stroke={ll} strokeWidth={0.7} opacity={0.5} />
        </G>
      );
      break;
    case "point":
      body = (
        <G>
          <Polygon points="16,58 16,30 26,16 26,58" fill={color} />
          <Polygon points="26,58 26,16 36,30 36,58" fill={d} />
          <Polygon points="34,58 34,36 42,24 42,58" fill={l} />
          <Polygon points="42,58 42,24 50,36 50,58" fill={color} />
          <Rect x={10} y={56} width={46} height={4} rx={2} fill={dd} />
        </G>
      );
      break;
    case "rhomb":
      body = (
        <G>
          <Polygon points="10,28 30,16 54,22 34,34" fill={l} />
          <Polygon points="10,28 34,34 30,54 6,48" fill={color} />
          <Polygon points="34,34 54,22 50,42 30,54" fill={d} />
        </G>
      );
      break;
    case "tabular":
      body = (
        <G>
          <Polygon points="8,30 26,18 56,22 38,34" fill={l} />
          <Polygon points="8,30 38,34 38,42 8,38" fill={color} />
          <Polygon points="38,34 56,22 56,30 38,42" fill={d} />
          <Polygon points="16,40 32,32 50,36 34,44" fill={ll} opacity={0.6} />
        </G>
      );
      break;
    case "botryoidal":
      body = (
        <G>
          <Ellipse cx={32} cy={50} rx={26} ry={8} fill={dd} />
          {[
            [18, 40, 11],
            [32, 34, 13],
            [46, 40, 11],
            [25, 46, 9],
            [40, 47, 9],
          ].map(([x, y, rr], i) => (
            <G key={i}>
              <Circle cx={x} cy={y} r={rr} fill={color} />
              <Circle cx={x - rr / 3} cy={y - rr / 3} r={rr / 3} fill={ll} opacity={0.7} />
            </G>
          ))}
        </G>
      );
      break;
    case "nugget":
      body = (
        <G>
          <Path d="M12 38c2-12 12-20 22-18 9 1 18 5 19 14 2 11-9 20-21 20S10 50 12 38Z" fill={color} />
          <Path d="M20 30c5-6 13-7 18-5" stroke={ll} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d="M18 46c8 6 22 6 30-2" stroke={d} strokeWidth={3} strokeLinecap="round" fill="none" />
        </G>
      );
      break;
    case "fibrous":
      body = (
        <G>
          <Ellipse cx={32} cy={52} rx={22} ry={6} fill={dd} />
          {Array.from({ length: 9 }, (_, i) => (
            <Path
              key={i}
              d={`M32 52 L${10 + i * 5.5} ${14 + Math.abs(4 - i) * 3}`}
              stroke={i % 2 ? color : l}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          ))}
        </G>
      );
      break;
    case "layered":
      body = (
        <G>
          {[0, 1, 2, 3, 4].map((i) => (
            <Polygon
              key={i}
              points={`${10 + i},${22 + i * 7} ${30 + i},${14 + i * 7} ${56 - i},${20 + i * 7} ${36 - i},${28 + i * 7}`}
              fill={i % 2 ? color : l}
              stroke={d}
              strokeWidth={0.6}
            />
          ))}
        </G>
      );
      break;
    case "granular":
      body = (
        <G>
          <Path d="M8 36 18 16l26-4 14 18-6 22-26 6Z" fill={color} />
          {[
            [18, 26, dd],
            [30, 20, ll],
            [40, 30, d],
            [24, 40, l],
            [36, 44, dd],
            [46, 22, l],
            [16, 46, d],
            [44, 40, ll],
            [28, 31, d],
          ].map(([x, y, c], i) => (
            <Polygon
              key={i}
              points={`${x},${y as number - 3} ${(x as number) + 4},${y} ${x},${(y as number) + 3} ${(x as number) - 3},${y}`}
              fill={c as string}
            />
          ))}
        </G>
      );
      break;
    case "glassy":
      body = (
        <G>
          <Path d="M8 40 20 14l30 2 8 22-20 18-24-4Z" fill={color} />
          <Path d="M20 14 30 34 50 16M30 34 38 56M30 34 8 40" stroke={l} strokeWidth={1} fill="none" opacity={0.6} />
          <Path d="M18 22c6-4 14-4 20-2" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" opacity={0.35} fill="none" />
        </G>
      );
      break;
    case "banded":
      body = (
        <G>
          <Path d="M8 36c0-14 12-24 26-24s24 10 24 24-11 22-25 22S8 50 8 36Z" fill={d} />
          {[18, 14, 10, 6].map((rr, i) => (
            <Ellipse key={i} cx={33} cy={36} rx={rr + 4} ry={rr} fill={i % 2 ? l : color} />
          ))}
        </G>
      );
      break;
    default:
      body = (
        <G>
          <Polygon points="10,24 26,8 47,15 58,40 46,58 17,54 5,38" fill={color} />
          <Polygon points="26,8 29,30 10,24" fill={l} />
          <Polygon points="29,30 47,15 58,40" fill={d} />
          <Polygon points="29,30 17,54 5,38" fill={dd} opacity={0.6} />
        </G>
      );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {body}
    </Svg>
  );
}

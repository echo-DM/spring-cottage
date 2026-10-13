export type ViewId = 'overview' | 'orioles' | 'egrets' | 'window' | 'boats';
export type Point = readonly [number, number, number];

export interface View {
  id: ViewId;
  label: string;
  verse?: string;
  description: string;
  position: Point;
  target: Point;
  minDistance: number;
  maxDistance: number;
  maxPolarAngle: number;
}

export const poem = {
  title: '绝句',
  author: '杜甫',
  dynasty: '唐',
  sourceName: '香港教育局 · 建议篇章《绝句》',
  sourceUrl:
    'https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/recommended-passages/ks2_11_text.pdf',
  interpretation:
    '全文依教育局收录版本转为简体。草堂、垂柳、河岸与西岭在同一世界中布局；草堂形制、码头、花草与河道为视觉补充，空间距离经过压缩，并非历史地理复原。黄鹂鸣唱以姿态呈现，本页采用纯视觉体验。',
};

export const overview: View = {
  id: 'overview',
  label: '草堂春望',
  description: '柳色新，江水碧。把一整个春天，收进一扇窗。',
  position: [94, 70, 124],
  target: [-4, 14, -20],
  minDistance: 28,
  maxDistance: 230,
  maxPolarAngle: Math.PI * 0.48,
};

export const verses: readonly View[] = [
  {
    id: 'orioles',
    label: '翠柳闻莺',
    verse: '两个黄鹂鸣翠柳，',
    description: '两点鹅黄，落在新绿之间。春意从枝头醒来。',
    position: [12, 11.5, 38],
    target: [1, 9.5, 18],
    minDistance: 9,
    maxDistance: 46,
    maxPolarAngle: Math.PI * 0.64,
  },
  {
    id: 'egrets',
    label: '白鹭凌空',
    verse: '一行白鹭上青天。',
    description: '沿着一行白鹭，目光越过河谷，走向更远的天空。',
    position: [21, 11, 43],
    target: [8, 30, -18],
    minDistance: 16,
    maxDistance: 100,
    maxPolarAngle: Math.PI * 0.76,
  },
  {
    id: 'window',
    label: '一窗千秋雪',
    verse: '窗含西岭千秋雪，',
    description: '一方窗框，框住遥远的西岭。春色里，雪仍未消。',
    position: [-22, 6.8, -8],
    target: [-24, 48, -152],
    minDistance: 12,
    maxDistance: 175,
    maxPolarAngle: Math.PI * 0.72,
  },
  {
    id: 'boats',
    label: '门前万里船',
    verse: '门泊东吴万里船。',
    description: '远行的船，停在眼前。小小草堂，也连着万里江山。',
    position: [-5, 13, 43],
    target: [22, 4, 20],
    minDistance: 12,
    maxDistance: 75,
    maxPolarAngle: Math.PI * 0.49,
  },
];

export function getView(id: ViewId): View {
  return verses.find((view) => view.id === id) ?? overview;
}

#!/usr/bin/env node

function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

function buildUlamSpiral(size) {
  if (size % 2 === 0) {
    throw new Error('O tamanho da espiral precisa ser ímpar.');
  }

  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  const center = Math.floor(size / 2);

  let x = center;
  let y = center;
  let value = 1;
  grid[y][x] = value;

  let step = 1;
  const directions = [
    [1, 0],
    [0, -1],
    [-1, 0],
    [0, 1],
  ];

  while (value < size * size) {
    for (let d = 0; d < directions.length; d += 1) {
      const [dx, dy] = directions[d];
      const moves = d < 2 ? step : step + 1;

      for (let m = 0; m < moves && value < size * size; m += 1) {
        x += dx;
        y += dy;
        value += 1;
        if (x >= 0 && x < size && y >= 0 && y < size) {
          grid[y][x] = value;
        }
      }
    }
    step += 2;
  }

  return grid;
}

function renderPrimeMap(grid) {
  return grid
    .map((row) => row.map((n) => (isPrime(n) ? '●' : '·')).join(' '))
    .join('\n');
}

function buildPrimeHelix(limit) {
  const points = [];

  for (let n = 2; n <= limit; n += 1) {
    if (!isPrime(n)) continue;

    const angle = n * 0.45;
    const radius = 2 + Math.log(n);
    const x = Number((radius * Math.cos(angle)).toFixed(3));
    const y = Number((radius * Math.sin(angle)).toFixed(3));
    const z = Number((n / 3).toFixed(3));

    points.push({ n, x, y, z });
  }

  return points;
}

function main() {
  const size = Number(process.argv[2] ?? 21);
  const limit = Number(process.argv[3] ?? 200);

  const spiral = buildUlamSpiral(size);
  const helix = buildPrimeHelix(limit);

  console.log(`\nPadrão 2D (Espiral de Ulam) - tamanho ${size}x${size}\n`);
  console.log(renderPrimeMap(spiral));

  console.log(`\nPadrão 3D (hélice de primos) - até ${limit}\n`);
  console.log('n,x,y,z');
  helix.forEach((point) => {
    console.log(`${point.n},${point.x},${point.y},${point.z}`);
  });
}

main();

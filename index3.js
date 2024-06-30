import * as THREE from 'https://unpkg.com/three@0.112/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com:3000/three@0.112/examples/jsm/controls/OrbitControls.js';

const container = document.getElementById('container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.z = 5;

const points = [];
const geometry = new THREE.BufferGeometry();
const material = new THREE.PointsMaterial({ size: 0.04, color: 0x00ffff });
const pointsObject = new THREE.Points(geometry, material);

async function loadPoints(file) {
    const loader = new THREE.FileLoader();
    loader.load(file, function(text) {
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') continue;
            const coords = line.replace(/{/g, '[').replace(/}/g, ']').replace(/;/g,',');
            const scaledCoords = JSON.parse(coords).map(c => c * 0.01);
            const x = parseFloat(scaledCoords[0]);
            const y = parseFloat(scaledCoords[1]);
            const z = parseFloat(scaledCoords[2]);
            points.push(new THREE.Vector3(x, y, z));
        }
        init();
    });
}

loadPoints('points.txt').then(() => {});

async function init() {
    geometry.setFromPoints(points);

    const grid = await separatePoints(points, 101);
    scene.add(pointsObject);
    console.log(grid);
    createLines([grid[23]], 1);
    animate();
}

async function separatePoints(points, gridSize) {
    const array2D = new Array(gridSize);
    for (let i = 0; i < gridSize; i++) {
        array2D[i] = [];
    }
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const row = Math.floor(i / gridSize);
        array2D[row].push(point);
    }
    return array2D;
}

async function createLines(grid, gridSize) {
    for (let i = 0; i < gridSize; i++) {
        const rowPoints = grid[i];
        if (rowPoints.length > 1) {
            const geometry = new THREE.BufferGeometry();
            const material = new THREE.LineBasicMaterial({ color: 0x00ffff });
            const line = new THREE.Line(geometry, material);
            const positions = rowPoints.map(p => p);
            geometry.setFromPoints(positions);
            scene.add(line);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}


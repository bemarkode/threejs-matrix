import * as THREE from "https://unpkg.com/three@0.112/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.112/examples/jsm/controls/OrbitControls.js";

const container = document.getElementById("container");

const points = await fetch("points_cleaned.txt")
    .then((response) => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
    })
    .then((data) => {
        const lines = data.split("\n");
        const points = lines.map((line) => {
            const values = line.split(",").map((value) => parseFloat(value));
            return new THREE.Vector3(values[0], values[1], values[2]);
        });
        return points;
    })
    .catch((error) => {
        console.error("Error:", error);
    });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(500, 500);
const controls = new OrbitControls(camera, renderer.domElement);
container.appendChild(renderer.domElement);
camera.position.z = 5;

const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(points.length * 3);

for (let i = 0; i < points.length; i++) {
    const point = points[i];
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
}

geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const material = new THREE.PointsMaterial({ size: 1, color: 0x00ffff });
const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

const center = new THREE.Vector3();

for (let i = 0; i < points.length; i++) {
    center.add(points[i]);
}

center.divideScalar(points.length);

let radius = 0;

for (let i = 0; i < points.length; i++) {
    radius = Math.max(radius, center.distanceTo(points[i]));
}

camera.position.copy(center);
camera.position.z += radius;
camera.near = radius / 100;
camera.far = radius * 100;
camera.updateProjectionMatrix();

async function drawLinesAtIndex(index) {
    const gridSize = 101; // Assuming the grid is 101x101
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    const rowPoints = [];
    const colPoints = [];

    // Extract points for the row
    for (let i = 0; i < gridSize; i++) {
        rowPoints.push(points[row * gridSize + i]);
    }

    // Extract points for the column
    for (let i = 0; i < gridSize; i++) {
        colPoints.push(points[i * gridSize + col]);
    }

    const rowGeometry = new THREE.BufferGeometry().setFromPoints(rowPoints);
    const colGeometry = new THREE.BufferGeometry().setFromPoints(colPoints);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const rowLine = new THREE.Line(rowGeometry, lineMaterial);
    const colLine = new THREE.Line(colGeometry, lineMaterial);
    scene.add(rowLine);
    scene.add(colLine);
}

await drawLinesAtIndex(2352);


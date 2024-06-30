import * as THREE from "https://unpkg.com/three@0.112/build/three.module.js";
//import { OrbitControls } from "https://unpkg.com/three@0.112/examples/jsm/controls/OrbitControls.js";

const container = document.getElementById("container");

let scene, camera, renderer, particleSystem, center, radius;
let rowLine, columnLine;

async function init() {
    const points = await loadPoints();
    setupScene(points);
    createGridLines(points, 23, 26); 
    setupScrollAnimation();
}

async function loadPoints() {
    try {
        const response = await fetch("points_cleaned.txt");
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.text();
        const lines = data.split("\n");
        return lines.map(line => {
            const values = line.split(",").map(value => parseFloat(value));
            return new THREE.Vector3(values[0], values[1], values[2]);
        });
    } catch (error) {
        console.error("Error loading points:", error);
    }
}

function setupScene(points) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    console.log(container.innerWidth);
    container.appendChild(renderer.domElement);
    
    //controls = new OrbitControls(camera, renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);

    center = new THREE.Vector3();
    radius = 0;

    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
        center.add(point);
    }

    center.divideScalar(points.length);

    for (let i = 0; i < points.length; i++) {
        radius = Math.max(radius, center.distanceTo(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])));
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ size: 3, color: 0x00ffff });
    particleSystem = new THREE.Points(geometry, material);
    particleSystem.scale.z = 0.01;
    scene.add(particleSystem);

    // Adjust camera position
    camera.position.set(center.x, center.y - radius * 2, center.z + radius/2 );
    camera.lookAt(center);
    //controls.target.copy(center);

    // Add ambient light to ensure points are visible
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function createGridLines(points, rowIndex, columnIndex) {
    const gridSize = 101; // Your grid size

    // Create row line
    const rowPoints = [];
    for (let i = 0; i < gridSize; i++) {
        rowPoints.push(points[rowIndex * gridSize + i]);
    }
    const rowGeometry = new THREE.BufferGeometry().setFromPoints(rowPoints);
    const rowMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red color for row
    rowLine = new THREE.Line(rowGeometry, rowMaterial);
    rowLine.geometry.setDrawRange(0, 0); // Start with no points drawn
    rowLine.scale.z = 0.01;
    scene.add(rowLine);

    // Create column line
    const columnPoints = [];
    for (let i = 0; i < gridSize; i++) {
        columnPoints.push(points[i * gridSize + columnIndex]);
    }
    const columnGeometry = new THREE.BufferGeometry().setFromPoints(columnPoints);
    const columnMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green color for column
    columnLine = new THREE.Line(columnGeometry, columnMaterial);
    columnLine.geometry.setDrawRange(0, 0); // Start with no points drawn
    columnLine.scale.z = 0.01;
    scene.add(columnLine);
}

function animateGridLines(progress) {
    if (rowLine && columnLine) {
        const totalPoints = 101; // Total points in each line
        const pointsToDraw = Math.floor(progress * totalPoints);
        
        // Animate row line from left to right
        rowLine.geometry.setDrawRange(0, pointsToDraw);
        
        // Animate column line from bottom to top
        columnLine.geometry.setDrawRange(0, pointsToDraw);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupScrollAnimation() {
    gsap.registerPlugin(ScrollTrigger);

    ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: "+=300%",
        scrub: 0,
        pin: true,
        anticipatePin: 0,
        onUpdate: (self) => {
            const progress = self.progress;
            particleSystem.scale.z = 0.01 + progress * 0.99; // Scale from 0.01 to 1
            rowLine.scale.z = 0.01 + progress * 0.99; // Scale from 0.01 to 1
            columnLine.scale.z = 0.01 + progress * 0.99; // Scale from 0.01 to 1
            animateGridLines(progress);
        },
    });
}

function animate() {
    requestAnimationFrame(animate);
    //controls.update();
    renderer.render(scene, camera);
}

init();
import './style.css'
import * as THREE from 'three'
import { Viewer } from './viewer'

const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!
const dropzone = document.querySelector<HTMLDivElement>('#dropzone')!
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!
const statsEl = document.querySelector<HTMLDivElement>('#stats')!
const btnWireframe = document.querySelector<HTMLButtonElement>('#btn-wireframe')!
const btnAutorotate = document.querySelector<HTMLButtonElement>('#btn-autorotate')!
const btnReset = document.querySelector<HTMLButtonElement>('#btn-reset')!
const btnClear = document.querySelector<HTMLButtonElement>('#btn-clear')!

const viewer = new Viewer(canvas, (stats) => {
  statsEl.textContent = stats.objects
    ? `Meshes: ${stats.objects} · Tris: ${stats.tris.toLocaleString('pt-BR')}`
    : 'Nenhum modelo carregado'
})

function isFBX(file: File) {
  return file.name.toLowerCase().endsWith('.fbx')
}

function isImage(file: File) {
  return file.type.startsWith('image/')
}

async function handleFiles(files: FileList | File[]) {
  const list = Array.from(files)
  const fbxFile = list.find(isFBX)
  const imageFile = list.find(isImage)

  if (!fbxFile) {
    alert('Nenhum arquivo .fbx encontrado. Solte o modelo e, opcionalmente, a textura.')
    return
  }

  let texture: THREE.Texture | undefined
  if (imageFile) {
    const url = URL.createObjectURL(imageFile)
    texture = await new THREE.TextureLoader().loadAsync(url)
    texture.colorSpace = THREE.SRGBColorSpace
    URL.revokeObjectURL(url)
  }

  const buffer = await fbxFile.arrayBuffer()
  await viewer.loadFBX(buffer, texture)
  dropzone.classList.add('hidden')
}

// --- Drag and drop ---
;['dragenter', 'dragover'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault()
    dropzone.classList.add('dragover')
  }),
)
;['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault()
    dropzone.classList.remove('dragover')
  }),
)
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files.length) handleFiles(e.dataTransfer.files)
})
dropzone.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  if (fileInput.files?.length) handleFiles(fileInput.files)
})

// --- Toolbar ---
btnWireframe.addEventListener('click', () => {
  const on = viewer.toggleWireframe()
  btnWireframe.classList.toggle('active', on)
})
btnAutorotate.addEventListener('click', () => {
  const on = viewer.toggleAutoRotate()
  btnAutorotate.classList.toggle('active', on)
})
btnReset.addEventListener('click', () => viewer.resetCamera())
btnClear.addEventListener('click', () => {
  viewer.clearModel()
  dropzone.classList.remove('hidden')
})

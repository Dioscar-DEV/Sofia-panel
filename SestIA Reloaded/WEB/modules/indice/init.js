(function(){
	async function init(){
		const { supabase, session } = window.App;
		// Elementos
		const listEl = document.getElementById('indice-list');
		const emptyEl = document.getElementById('indice-empty');
		const searchEl = document.getElementById('indice-search');
		const newBtn = document.getElementById('indice-new-btn');
		const modal = document.getElementById('indice-modal');
		const form = document.getElementById('indice-form');
		const formTema = document.getElementById('form-tema');
		const formDescripcion = document.getElementById('form-descripcion');
		const formContenido = document.getElementById('form-contenido');
		const formEtiquetas = document.getElementById('form-etiquetas');
		const formColor = document.getElementById('form-color');
		const colorPicker = document.getElementById('color-picker');
		const detailColorPicker = document.getElementById('detail-color-picker');
		const formActivo = document.getElementById('form-activo');
		const formAI = document.getElementById('form-ai');
		const modalTitle = document.getElementById('modal-title');
		const modalSave = document.getElementById('modal-save');
		const modalCancel = document.getElementById('modal-cancel');

		const detailEmpty = document.getElementById('indice-detail-empty');
		const detailArticle = document.getElementById('indice-detail');
		const detailTitle = document.getElementById('detail-title');
		const detailDescription = document.getElementById('detail-description');
		const detailTags = document.getElementById('detail-tags');
		const toggleActive = document.getElementById('toggle-active');
		const toggleAvailable = document.getElementById('toggle-available');
		const detailColor = document.getElementById('detail-color');
		const editBtn = document.getElementById('edit-btn');
		const deleteBtn = document.getElementById('delete-btn');
		const detailContent = document.getElementById('detail-content');
		const detailLogList = document.getElementById('detail-log-list');

		let items = [];
		let selectedId = null;
		let editingId = null;

		function parseTags(text){
			return (text || '').split(',').map(t => t.trim()).filter(Boolean);
		}

		function renderList(){
			listEl.innerHTML = '';
			const term = (searchEl.value || '').toLowerCase();
			const filtered = items.filter(x => {
				const hay = [x.tema, x.descripcion, x.tool].map(v => (v||'').toLowerCase()).join(' ');
				return hay.includes(term);
			});
			console.log('🎨 Renderizando lista con', filtered.length, 'items');
			emptyEl.classList.toggle('hidden', filtered.length > 0);
			filtered.forEach(x => {
				console.log('📝 Procesando item:', { id: x.id, tema: x.tema });
				const el = document.createElement('div');
				el.className = 'indice-item' + (x.id === selectedId ? ' active' : '');
				el.setAttribute('role','button');
				el.setAttribute('tabindex','0');
				el.addEventListener('click', () => selectItem(x.id));
				el.addEventListener('keypress', (e) => { if(e.key==='Enter'){ selectItem(x.id); } });

				const colorDot = document.createElement('div');
				colorDot.className = 'color-dot';
				colorDot.style.background = '#2563eb'; // Color por defecto

				const main = document.createElement('div');
				main.className = 'item-main';
				const h = document.createElement('h4'); h.className='item-title'; h.textContent = x.tema || '(Sin tema)';
				const p = document.createElement('p'); p.className='item-sub'; p.textContent = x.descripcion || '';

				const badges = document.createElement('div');
				badges.className = 'item-badges';
				const tagList = document.createElement('div'); tagList.className='tag-list';
				if(x.tool) {
					const b = document.createElement('span'); b.className='badge'; b.textContent = `Tool: ${x.tool}`; tagList.appendChild(b);
				}
				const bActivo = document.createElement('span'); 
				bActivo.className='badge'; 
				bActivo.textContent = x.activo ? 'Activo' : 'Inactivo';
				bActivo.style.background = x.activo ? '#10b981' : '#6b7280';

				badges.appendChild(tagList);
				badges.appendChild(bActivo);

				main.appendChild(h);
				main.appendChild(p);
				main.appendChild(badges);

				el.appendChild(colorDot);
				el.appendChild(main);
				listEl.appendChild(el);
			});
		}

		function renderDetail(item){
			if(!item){
				detailArticle.classList.add('hidden');
				detailEmpty.classList.remove('hidden');
				return;
			}
			detailEmpty.classList.add('hidden');
			detailArticle.classList.remove('hidden');
			detailTitle.textContent = item.tema || '';
			detailDescription.textContent = item.descripcion || '';
			detailColor.value = '#2563eb'; // Color por defecto
			updateDetailColorPicker('#2563eb');
			toggleActive.checked = !!item.activo;
			toggleAvailable.checked = !!item.tool;
			detailContent.textContent = item.contenido || '';
			detailTags.innerHTML = '';
			if(item.tool) {
				const b = document.createElement('span'); 
				b.className='badge'; 
				b.textContent = `Tool: ${item.tool}`; 
				detailTags.appendChild(b);
			}
		}

		async function loadLog(id){
			detailLogList.innerHTML = '';
			if (!id) {
				console.warn('⚠️ ID no válido para cargar log:', id);
				return;
			}
			console.log('📋 Cargando log para ID:', id);
			const { data, error } = await supabase
				.schema('instancia_sofia')
				.from('indice_log')
				.select('*')
				.eq('indice_id', id)
				.order('created_at', { ascending: false });
			if(error){ 
				console.error('❌ Error cargando log:', error); 
				return; 
			}
			console.log('📊 Log cargado:', data);
			(data||[]).forEach(row => {
				const el = document.createElement('div'); el.className='log-entry';
				const meta = document.createElement('div'); meta.className='log-meta'; meta.textContent = new Date(row.created_at).toLocaleString('es-CO');
				const who = document.createElement('strong'); who.textContent = row.user_email || 'sistema';
				const act = document.createElement('span'); act.textContent = ` — ${row.action}`;
				el.appendChild(meta); el.appendChild(who); el.appendChild(act);
				detailLogList.appendChild(el);
			});
		}

		async function fetchItems(){
			console.log('🔍 Cargando items del índice desde instancia_sofia...');
			
			const { data, error } = await supabase
				.schema('instancia_sofia')
				.from('indice')
				.select('*')
				.order('created_at', { ascending: false });
			
			if(error){ 
				console.error('❌ Error cargando items:', error); 
				alert('Error al cargar el índice: ' + error.message);
				return; 
			}
			console.log('📊 Datos recibidos de instancia_sofia.indice:', data);
			items = Array.isArray(data) ? data : [];
			console.log('📝 Items procesados:', items.length);
			renderList();
		}

		function openModal(editing){
			if(editing){
				modalTitle.textContent = '✏️ Editar Tema';
				modal.setAttribute('data-mode','edit');
			}else{
				modalTitle.textContent = '📝 Nuevo Tema';
				modal.setAttribute('data-mode','new');
			}
			if(typeof modal.showModal === 'function'){
				modal.showModal();
			}else{
				modal.classList.remove('hidden');
			}
			// Pequeña animación de entrada
			setTimeout(() => {
				modal.style.animation = 'modalFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
			}, 10);
		}

		function closeModal(){
			form.reset();
			editingId = null;
			if(typeof modal.close === 'function'){
				modal.close();
			}else{
				modal.classList.add('hidden');
			}
		}

		function selectItem(id){
			console.log('🎯 Seleccionando item con ID:', id);
			console.log('📋 Items disponibles:', items.map(i => ({ id: i.id, tema: i.tema })));
			selectedId = id;
			renderList();
			const item = items.find(x => x.id === id);
			console.log('🔍 Item encontrado:', item);
			renderDetail(item);
			loadLog(id);
		}

		const canManage = window.App?.hasPerm && window.App.hasPerm('indice.manage');
		if(newBtn && !canManage){ newBtn.style.display = 'none'; }

		newBtn.addEventListener('click', () => {
			editingId = null;
			formTema.value = '';
			formDescripcion.value = '';
			formContenido.value = '';
			formEtiquetas.value = '';
			formColor.value = '#2563eb';
			updateColorPicker('#2563eb');
			formActivo.checked = true;
			formAI.checked = false;
			openModal(false);
		});

		editBtn.addEventListener('click', () => {
			if(!selectedId){ return; }
			const it = items.find(x => x.id === selectedId);
			if(!it){ return; }
			editingId = it.id;
			formTema.value = it.tema || '';
			formDescripcion.value = it.descripcion || '';
			formContenido.value = it.contenido || '';
			formEtiquetas.value = it.tool || '';
			formColor.value = '#2563eb';
			updateColorPicker('#2563eb');
			formActivo.checked = !!it.activo;
			formAI.checked = !!it.tool;
			openModal(true);
		});

		modalCancel.addEventListener('click', (e) => {
			e?.preventDefault?.();
			closeModal();
		});

		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			if(!canManage){ alert('No tienes permiso para modificar el índice'); return; }
			const payload = {
				tema: formTema.value.trim(),
				descripcion: formDescripcion.value.trim(),
				contenido: formContenido.value,
				tool: formEtiquetas.value.trim() || null,
				activo: !!formActivo.checked
			};
			if(!payload.tema){ 
				formTema.focus();
				formTema.classList.add('pulse-effect');
				setTimeout(() => formTema.classList.remove('pulse-effect'), 600);
				return; 
			}
			
			// Feedback visual de carga
			modalSave.disabled = true;
			modalSave.innerHTML = '<svg width="16" height="16" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M4 12a8 8 0 018-8" opacity="1"/></svg> Guardando...';
			
			try {
				if(editingId){
					// Actualizar existente
					const { data, error } = await supabase
						.schema('instancia_sofia')
						.from('indice')
						.update(payload)
						.eq('id', editingId)
						.select();
					if(error) throw error;
				}else{
					// Crear nuevo
					const { data, error } = await supabase
						.schema('instancia_sofia')
						.from('indice')
						.insert([payload])
						.select();
					if(error) throw error;
				}
				closeModal();
				await fetchItems();
				alert('✅ Guardado exitosamente');
			} catch(error) {
				alert('Error: ' + error.message);
				console.error('Error guardando:', error);
			} finally {
				modalSave.disabled = false;
				modalSave.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>Guardar';
			}
		});

		deleteBtn.addEventListener('click', async () => {
			if(!selectedId){ return; }
			const it = items.find(x => x.id === selectedId);
			if(!it){ return; }
			const ok = confirm(`¿Eliminar "${it.tema}"? Esta acción no se puede deshacer.`);
			if(!ok){ return; }
			if(!canManage){ alert('No tienes permiso para eliminar'); return; }
			
			const { error } = await supabase
				.schema('instancia_sofia')
				.from('indice')
				.delete()
				.eq('id', selectedId);
			
			if(error){ 
				alert('Error al eliminar: ' + error.message); 
				return; 
			}
			selectedId = null;
			renderDetail(null);
			await fetchItems();
			alert('✅ Eliminado exitosamente');
		});

		toggleActive.addEventListener('change', async () => {
			if(!selectedId){ return; }
			if(!canManage){ toggleActive.checked = !toggleActive.checked; return; }
			
			const { error } = await supabase
				.schema('instancia_sofia')
				.from('indice')
				.update({ activo: toggleActive.checked })
				.eq('id', selectedId);
			
			if(error){ 
				alert('Error: ' + error.message); 
				toggleActive.checked = !toggleActive.checked;
				return; 
			}
			await fetchItems();
		});

		toggleAvailable.addEventListener('change', async () => {
			if(!selectedId){ return; }
			if(!canManage){ toggleAvailable.checked = !toggleAvailable.checked; return; }
			
			const { error } = await supabase
				.schema('instancia_sofia')
				.from('indice')
				.update({ tool: toggleAvailable.checked ? 'available' : null })
				.eq('id', selectedId);
			
			if(error){ 
				alert('Error: ' + error.message); 
				toggleAvailable.checked = !toggleAvailable.checked;
				return; 
			}
			await fetchItems();
		});

		detailColor.addEventListener('change', async () => {
			if(!selectedId){ return; }
			if(!canManage){ return; }
			// Nota: La tabla instancia_sofia.indice no tiene campo color, se omite esta funcionalidad
			console.log('Campo color no disponible en instancia_sofia.indice');
		});

		searchEl.addEventListener('input', () => renderList());

		// Color picker
		colorPicker.addEventListener('click', (e) => {
			if (e.target.classList.contains('color-option')) {
				// Remover active de todos
				colorPicker.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
				// Añadir active al seleccionado
				e.target.classList.add('active');
				// Actualizar valor
				formColor.value = e.target.dataset.color;
			}
		});

		// Función para actualizar color picker cuando se edita
		function updateColorPicker(color) {
			colorPicker.querySelectorAll('.color-option').forEach(opt => {
				opt.classList.toggle('active', opt.dataset.color === color);
			});
		}

		// Función para actualizar color picker del detalle
		function updateDetailColorPicker(color) {
			if (detailColorPicker) {
				detailColorPicker.querySelectorAll('.color-option').forEach(opt => {
					opt.classList.toggle('active', opt.dataset.color === color);
				});
			}
		}

		// Color picker del detalle
		if (detailColorPicker) {
			detailColorPicker.addEventListener('click', (e) => {
				if (e.target.classList.contains('color-option')) {
					const newColor = e.target.dataset.color;
					// Actualizar visualmente
					updateDetailColorPicker(newColor);
					// Actualizar en BD
					if (selectedId) {
						detailColor.value = newColor;
						detailColor.dispatchEvent(new Event('change'));
					}
				}
			});
		}

		await fetchItems();
	}

	window.IndiceModule = { init };
})();



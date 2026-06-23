let dbAsientosBloques = []; 
let companyName = "Empresa No Definida";
let editandoModo = false; 

function getCurrencySign() {
    const select = document.getElementById('currencySelect');
    return select ? select.value : "C$ ";
}

function formatearDinero(valor) {
    const numero = parseFloat(valor) || 0;
    return numero.toLocaleString('es-NI', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function tieneAsientoApertura() {
    return dbAsientosBloques.some(bloque => bloque.tipo === "Asiento de Apertura");
}

if(document.getElementById('txDate')) {
    document.getElementById('txDate').valueAsDate = new Date();
}

if(document.getElementById('journalForm')) {
    document.getElementById('journalForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const targetGroup = document.getElementById('txGroupIndex').value;
        const tipo = document.getElementById('txType').value;
        const fecha = document.getElementById('txDate').value;
        const cuenta = document.getElementById('txAccount').value.trim();
        
        const debe = parseFloat(document.getElementById('txDebe').value) || 0;
        const haber = parseFloat(document.getElementById('txHaber').value) || 0;
        
        if (debe < 0 || haber < 0) {
            alert("Entrada inválida: No se permiten números negativos.");
            return;
        }

        if (debe === 0 && haber === 0) {
            alert("Error de registro: Debe ingresar obligatoriamente un valor monetario mayor a cero en el Debe o en el Haber.");
            return;
        }

        if (debe > 0 && haber > 0) {
            alert("Una sola línea de asiento debe ser un Débito o un Crédito, no ambos simultáneamente.");
            return;
        }

        if (!editandoModo) {
            if (targetGroup === "nuevo") {
                if (tipo !== "Asiento de Apertura" && !tieneAsientoApertura()) {
                    alert("Restricción del Sistema: Debe registrar obligatoriamente el Asiento de Apertura primero antes de poder ingresar asientos contables regulares.");
                    return;
                }
            } else {
                const index = parseInt(targetGroup);
                if (dbAsientosBloques[index] && dbAsientosBloques[index].tipo !== "Asiento de Apertura" && !tieneAsientoApertura()) {
                    alert("Restricción del Sistema: Debe registrar obligatoriamente el Asiento de Apertura primero.");
                    return;
                }
            }
        }

        const lineaMovimiento = { fecha, cuenta, debe, haber };

        if (targetGroup === "nuevo") {
            const nuevoBloque = {
                tipo: tipo,
                lineas: [lineaMovimiento]
            };
            
            if (tipo === "Asiento de Apertura") {
                dbAsientosBloques.unshift(nuevoBloque);
            } else {
                dbAsientosBloques.push(nuevoBloque);
            }
        } else {
            const index = parseInt(targetGroup);
            if (dbAsientosBloques[index]) {
                dbAsientosBloques[index].lineas.push(lineaMovimiento);
            } else {
                dbAsientosBloques.push({
                    tipo: tipo,
                    lineas: [lineaMovimiento]
                });
            }
        }
        
        document.getElementById('txDebe').value = 0;
        document.getElementById('txHaber').value = 0;
        document.getElementById('txAccount').value = "";
        document.getElementById('btnSubmitForm').innerText = "Procesar e Insertar Línea";
        
        editandoModo = false;
        
        renderAll();
        actualizarSelectorAsientos();
    });
}

function editarLineaDiario(bloqueIndex, lineaIndex) {
    const bloque = dbAsientosBloques[bloqueIndex];
    if (!bloque) return;
    
    const linea = bloque.lineas[lineaIndex];
    if (!linea) return;
    
    editandoModo = true;
    
    document.getElementById('txGroupIndex').value = bloqueIndex;
    document.getElementById('txType').value = bloque.tipo;
    document.getElementById('txDate').value = linea.fecha;
    document.getElementById('txAccount').value = linea.cuenta;
    document.getElementById('txDebe').value = linea.debe;
    document.getElementById('txHaber').value = linea.haber;
    
    document.getElementById('btnSubmitForm').innerText = "Guardar Corrección Actualizada";
    
    bloque.lineas.splice(lineaIndex, 1);
    
    if (bloque.lineas.length === 0) {
        dbAsientosBloques.splice(bloqueIndex, 1);
    }
    
    renderAll();
    actualizarSelectorAsientos();
    
    document.getElementById('journalForm').scrollIntoView({ behavior: 'smooth' });
}

function actualizarSelectorAsientos() {
    const select = document.getElementById('txGroupIndex');
    if(!select) return;
    select.innerHTML = '<option value="nuevo">+ Crear Nuevo Asiento Contable</option>';
    
    let regularCounter = 1;
    dbAsientosBloques.forEach((bloque, index) => {
        let label = "";
        if (bloque.tipo === "Asiento de Apertura") {
            label = "Asiento de Apertura";
        } else {
            label = `Asiento ${regularCounter}`;
            regularCounter++;
        }
        const option = document.createElement('option');
        option.value = index;
        option.text = `Añadir a: ${label}`;
        select.appendChild(option);
    });
    
    if(dbAsientosBloques.length > 0) {
        select.value = dbAsientosBloques.length - 1;
    }
}

function eliminarAsiento(index) {
    if (confirm("¿Estás seguro de que deseas deshacer este asiento completo con todos sus movimientos registrados?")) {
        dbAsientosBloques.splice(index, 1);
        editandoModo = false; 
        renderAll();
        actualizarSelectorAsientos();
    }
}

function saveCompany() {
    const input = document.getElementById('companyName').value.trim();
    if(input) {
        companyName = input;
        document.getElementById('currentCompany').innerText = companyName;
    }
}

function renderAll() {
    renderDiario();
    const mayor = calcularMayor();
    renderMayor(mayor);
    renderBalance(mayor);
    calcularYRenderizarAjustes(mayor);
}

function renderDiario() {
    const tbody = document.querySelector('#diarioTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    let totalDebe = 0; 
    let totalHaber = 0;
    const sign = getCurrencySign();

    let regularCounter = 1;
    dbAsientosBloques.forEach((bloque, bloqueIndex) => {
        const trSeparador = document.createElement('tr');
        trSeparador.className = "excel-asiento-row";
        
        const etiquetaAsiento = bloque.tipo === "Asiento de Apertura" ? "ASIENTO DE APERTURA" : `ASIENTO ${regularCounter}`;
        if (bloque.tipo !== "Asiento de Apertura") {
            regularCounter++;
        }
        
        trSeparador.innerHTML = `
            <td colspan="3" style="background-color: #ffff00; color: #000; padding: 6px 15px; vertical-align: middle;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-weight: 600; font-size: 0.95rem; margin-left: auto; margin-right: auto; transform: translateX(35px);">${etiquetaAsiento}</span>
                    <button type="button" onclick="eliminarAsiento(${bloqueIndex})" style="background-color: #e53935; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold; font-family: 'Poppins', sans-serif;">Deshacer</button>
                </div>
            </td>
        `;
        tbody.appendChild(trSeparador);

        bloque.lineas.forEach((linea, lineaIndex) => {
            totalDebe += linea.debe;
            totalHaber += linea.haber;
            
            const tr = document.createElement('tr');
            const styleCuenta = linea.haber > 0 ? 'padding-left: 35px; font-style: italic; color: #6a555a;' : 'font-weight: 500;';
            
            tr.innerHTML = `
                <td style="${styleCuenta} display: flex; justify-content: space-between; align-items: center;">
                    <span>${linea.cuenta}</span>
                    <a href="javascript:void(0)" onclick="editarLineaDiario(${bloqueIndex}, ${lineaIndex})" style="color: #e88b9c; font-size: 0.75rem; text-decoration: none; font-weight: 600; margin-left: 10px; border: 1px dashed #e88b9c; padding: 1px 5px; border-radius: 4px;">Editar</a>
                </td>
                <td style="text-align:right; vertical-align: middle;">${linea.debe > 0 ? sign + formatearDinero(linea.debe) : ''}</td>
                <td style="text-align:right; vertical-align: middle;">${linea.haber > 0 ? sign + formatearDinero(linea.haber) : ''}</td>
            `;
            tbody.appendChild(tr);
        });
    });

    if(document.getElementById('totalDebeDiario')) {
        document.getElementById('totalDebeDiario').innerText = sign + formatearDinero(totalDebe);
        document.getElementById('totalHaberDiario').innerText = sign + formatearDinero(totalHaber);
    }
}

function calcularMayor() {
    let cuentas = {};
    dbAsientosBloques.forEach(bloque => {
        bloque.lineas.forEach(l => {
            const nombreLlave = l.cuenta.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (!cuentas[nombreLlave]) {
                cuentas[nombreLlave] = { nombre: l.cuenta, debes: [], habers: [] };
            }
            if (l.debe > 0) cuentas[nombreLlave].debes.push(l.debe);
            if (l.haber > 0) cuentas[nombreLlave].habers.push(l.haber);
        });
    });
    return cuentas;
}

function renderMayor(cuentas) {
    const container = document.getElementById('mayorContainer');
    if(!container) return;
    container.innerHTML = '';
    const sign = getCurrencySign();

    Object.keys(cuentas).forEach(key => {
        const c = cuentas[key];
        const sumDebe = c.debes.reduce((a, b) => a + b, 0);
        const sumHaber = c.habers.reduce((a, b) => a + b, 0);
        
        let saldoDeudor = sumDebe >= sumHaber ? sumDebe - sumHaber : 0;
        let saldoAcreedor = sumHaber > sumDebe ? sumHaber - sumDebe : 0;

        const tDiv = document.createElement('div');
        tDiv.className = 't-account animate-fade';
        
        let debeHTML = c.debes.map(v => `<div class="t-val">${sign}${formatearDinero(v)}</div>`).join('');
        let haberHTML = c.habers.map(v => `<div class="t-val">${sign}${formatearDinero(v)}</div>`).join('');

        tDiv.innerHTML = `
            <div class="t-title">${c.nombre}</div>
            <div class="t-grid">
                <div class="t-col t-col-debe">${debeHTML}</div>
                <div class="t-col t-col-haber">${haberHTML}</div>
            </div>
            <div class="t-foot-sum">
                <div class="t-col t-col-debe"><strong>${sign}${formatearDinero(sumDebe)}</strong></div>
                <div class="t-col t-col-haber"><strong>${sign}${formatearDinero(sumHaber)}</strong></div>
            </div>
            <div class="t-bal-row">
                Saldo: ${saldoDeudor > 0 ? 'Deudor ' + sign + formatearDinero(saldoDeudor) : (saldoAcreedor > 0 ? 'Acreedor ' + sign + formatearDinero(saldoAcreedor) : 'Nulo ' + sign + '0.00')}
            </div>
        `;
        container.appendChild(tDiv);
    });
}

function renderBalance(cuentas) {
    const tbody = document.querySelector('#balanceTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let tMovDeudor = 0, tMovAcreedor = 0, tSDeudor = 0, tSAcreedor = 0;
    const sign = getCurrencySign();

    Object.keys(cuentas).forEach(key => {
        const c = cuentas[key];
        const movDebe = c.debes.reduce((a, b) => a + b, 0);
        const movHaber = c.habers.reduce((a, b) => a + b, 0);
        
        let sDeudor = 0;
        let sAcreedor = 0;
        
        if (movDebe >= movHaber) {
            sDeudor = movDebe - movHaber;
        } else {
            sAcreedor = movHaber - movDebe;
        }

        tMovDeudor += movDebe; 
        tMovAcreedor += movHaber;
        tSDeudor += sDeudor; 
        tSAcreedor += sAcreedor;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.nombre}</strong></td>
            <td style="text-align:right;">${sign}${formatearDinero(movDebe)}</td>
            <td style="text-align:right;">${sign}${formatearDinero(movHaber)}</td>
            <td style="text-align:right; color:#85586f;">${sDeudor > 0 ? sign + formatearDinero(sDeudor) : '-'}</td>
            <td style="text-align:right; color:#a27b5c;">${sAcreedor > 0 ? sign + formatearDinero(sAcreedor) : '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('balMovDeudor').innerText = sign + formatearDinero(tMovDeudor);
    document.getElementById('balMovAcreedor').innerText = sign + formatearDinero(tMovAcreedor);
    document.getElementById('balSaldoDeudor').innerText = sign + formatearDinero(tSDeudor);
    document.getElementById('balSaldoAcreedor').innerText = sign + formatearDinero(tSAcreedor);
}

function calcularYRenderizarAjustes(cuentas) {
    const gridContainer = document.getElementById('formulasGridContainer');
    if (!gridContainer) return;
    gridContainer.innerHTML = ''; 
    const sign = getCurrencySign();

    const obtenerSaldoRobustecido = (listaNombresPosibles) => {
        for (let nombre of listaNombresPosibles) {
            const llave = nombre.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (cuentas[llave]) {
                const sumDebe = cuentas[llave].debes.reduce((a, b) => a + b, 0);
                const sumHaber = cuentas[llave].habers.reduce((a, b) => a + b, 0);
                return Math.abs(sumDebe - sumHaber);
            }
        }
        return 0;
    };

    const ventas = obtenerSaldoRobustecido(["VENTAS"]);
    const devSVenta = obtenerSaldoRobustecido(["DEVOLUCIONES SOBRE VENTAS", "DEV/VENTAS", "DEV SOBRE VENTAS", "DEV. SOBRE VENTAS"]);
    const descSVenta = obtenerSaldoRobustecido(["REBAJAS SOBRE VENTAS", "REBAJA/VENTAS", "DESCUENTOS SOBRE VENTAS", "DESC/VENTAS", "DESC. SOBRE VENTAS"]);
    
    const compras = obtenerSaldoRobustecido(["COMPRAS"]);
    const gastosCompra = obtenerSaldoRobustecido(["GASTOS DE COMPRA", "GASTOS DE COMPRAS", "GASTOS S/COMPRA", "GASTOS S/ COMPRAS"]);
    
    const devSCompra = obtenerSaldoRobustecido(["DEVOLUCIONES SOBRE COMPRAS", "DEV/COMPRAS", "DEV SOBRE COMPRAS", "DEV. SOBRE COMPRAS"]);
    const descSCompra = obtenerSaldoRobustecido(["REBAJAS SOBRE COMPRAS", "REBAJA/COMPRAS", "DESCUENTOS SOBRE COMPRAS", "DESC/COMPRAS", "DESC. SOBRE COMPRAS"]);
    
    const inventarioInicial = obtenerSaldoRobustecido(["INVENTARIO INICIAL", "INVENTARIO", "MERCANCIAS", "MERCANCÍAS"]);
    
    const inputInvFinal = parseFloat(document.getElementById('invFinalInput').value);
    const inventarioFinal = (isNaN(inputInvFinal) || inputInvFinal < 0) ? 0 : inputInvFinal;

    const ventasNetas = ventas - (devSVenta + descSVenta);
    const comprasTotales = compras + gastosCompra;
    const comprasNetas = comprasTotales - (devSCompra + descSCompra);
    const sumaMercancias = comprasNetas + inventarioInicial;
    const costoDeLoVendido = sumaMercancias - inventarioFinal;
    const utilidadBruta = ventasNetas - costoDeLoVendido;

    gridContainer.innerHTML = `
        <div class="formula-card metric-ventas-netas">
            <span class="formula-title">Ventas Netas</span>
            <div class="formula-expression">Ventas − (Dev. s/Venta + Desc. s/Venta)</div>
            <div class="formula-value">${sign}${formatearDinero(ventasNetas)}</div>
        </div>
        <div class="formula-card metric-compras-totales">
            <span class="formula-title">Compras Totales</span>
            <div class="formula-expression">Compras + Gastos de compra</div>
            <div class="formula-value">${sign}${formatearDinero(comprasTotales)}</div>
        </div>
        <div class="formula-card metric-compras-netas">
            <span class="formula-title">Compras Netas</span>
            <div class="formula-expression">Compras totales − (Dev. s/compra + Desc. s/compra)</div>
            <div class="formula-value">${sign}${formatearDinero(comprasNetas)}</div>
        </div>
        <div class="formula-card metric-suma-mercancias">
            <span class="formula-title">Suma o total de mercancías</span>
            <div class="formula-expression">Compras netas + Inventario inicial</div>
            <div class="formula-value">${sign}${formatearDinero(sumaMercancias)}</div>
        </div>
        <div class="formula-card metric-costo-vendido">
            <span class="formula-title">Costo de lo vendido</span>
            <div class="formula-expression">Suma o total de mercancías − Inventario final</div>
            <div class="formula-value">${sign}${formatearDinero(costoDeLoVendido)}</div>
        </div>
        <div class="formula-card metric-utilidad-bruta" id="utilidadCardColor">
            <span class="formula-title" id="utilidadLabel">${utilidadBruta >= 0 ? 'Utilidad Bruta' : 'Pérdida Bruta'}</span>
            <div class="formula-expression">Ventas netas − Costo de lo vendido</div>
            <div class="formula-value">${sign}${formatearDinero(Math.abs(utilidadBruta))}</div>
        </div>
    `;

    const cardColor = document.getElementById('utilidadCardColor');
    if (cardColor) {
        if (utilidadBruta >= 0) {
            cardColor.style.backgroundColor = "#e8f5e9"; 
            cardColor.style.borderColor = "#81c784";
        } else {
            cardColor.style.backgroundColor = "#ffebee"; 
            cardColor.style.borderColor = "#e57373";
        }
    }
}

function switchTab(event, tabId) {
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => panel.classList.remove('active'));

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    const targetPanel = document.getElementById(tabId);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
    
    if (event && event.currentTarget && event.currentTarget.classList.contains('tab-btn')) {
        event.currentTarget.classList.add('active');
    } else {
        const correspondingTabBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
        if (correspondingTabBtn) {
            correspondingTabBtn.classList.add('active');
        }
    }

    const configFields = document.getElementById('configFieldsContainer');
    const manualImage = document.getElementById('manualImageContainer');
    
    if (configFields && manualImage) {
        if (tabId === 'tab-manual') {
            configFields.style.display = 'none';
            manualImage.style.display = 'block';
        } else {
            configFields.style.display = 'block';
            manualImage.style.display = 'none';
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'manual') {
        switchTab(null, 'tab-manual');
    }
});
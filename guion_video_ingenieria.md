# Guion video capacitación — Módulo de Ingeniería

Formato: texto corrido para pegar en ElevenLabs, sin timecodes. Tono formal y directo.
Cada párrafo = un corte de pantalla.

Estado: **solo la sección "Estado de Frentes" está cerrada.** El resto (Introducción, Tipos de Frente,
Frentes de Trabajo, Cierre) se redactó y ajustó en conversación pero todavía no se guardó en este archivo —
pendiente de armar el documento completo.

---

## Estado de Frentes

Continuamos con Estado de Frentes.

Esta funcionalidad permite hacer seguimiento al avance real de cada frente de trabajo, comparando lo planificado con lo efectivamente ejecutado en terreno.

Como en las secciones anteriores, cuenta con un botón "¿Cómo funciona?" que despliega un panel de ayuda. Ahí se explica qué se registra en esta pantalla: por cada frente, su nivel de ventilación, su estabilidad, la duración estimada y la fecha de inicio planificada. También se explica que, al marcar la fecha real de inicio, el sistema calcula automáticamente el desvío entre lo estimado y lo real, sin necesidad de calcularlo a mano, y se detalla el semáforo de estado: sin iniciar, en tiempo, atraso leve —de uno a cinco días— y atraso grave —más de cinco días.

Esta sección se organiza en tres pestañas: Resumen, Registros y Análisis.

La pestaña Resumen mostrará, una vez que existan registros, indicadores generales como la cantidad de frentes en tiempo, con atraso o sin iniciar, junto con una tarjeta individual por cada frente y su estado actual.

La pestaña Registros presentará el detalle completo en formato de tabla, donde también será posible editar o eliminar un registro.

Y la pestaña Análisis entregará estadísticas de cumplimiento: el porcentaje de frentes que se iniciaron a tiempo, el desvío promedio, el mejor y peor caso registrado, y un desglose del desvío promedio según el tipo de estabilidad del frente.

Como todavía no existen registros, comencemos creando el primero. Para esto, seleccione Nuevo Registro.

Deberá indicar el frente de trabajo correspondiente, su nivel de ventilación en una escala de uno a cinco, y su estabilidad, clasificada en categorías como Frente Cerrada, Acuñadura o Frente en Observación, entre otras. A continuación, ingrese la duración estimada en días y la fecha de inicio estimada para ese frente. De forma opcional, puede agregar alguna observación adicional en el campo correspondiente. Una vez completada la información, seleccione Guardar para registrar el seguimiento, o Cancelar si desea salir sin guardar los cambios.

Una vez que el frente comienza a operar en terreno, podrá marcar su inicio real desde el listado, indicando la fecha en que efectivamente comenzó. Con esa fecha, el sistema calculará automáticamente el desvío y actualizará el semáforo de estado.

De esta manera, Estado de Frentes permite anticipar atrasos y evaluar, con datos reales, qué condiciones de terreno pueden tener un mayor impacto en la planificación.

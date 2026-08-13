# Guion video capacitación — Módulo de Ingeniería

Formato: texto corrido para pegar en ElevenLabs, sin timecodes. Tono formal y directo.
Cada párrafo = un corte de pantalla.

Orden de la serie: Introducción → Tipos de Frente → Frentes de Trabajo → Estado de Frentes → Cierre.

Estado: **"Tipos de Frente" y "Estado de Frentes" cerradas.** El resto (Introducción, Frentes de Trabajo, Cierre)
se redactó y ajustó en conversación pero todavía no se guardó en este archivo — pendiente de armar el documento completo.

---

## Tipos de Frente

Comenzamos con Tipos de Frente, porque es aquí donde parte todo: un tipo tiene que existir antes de poder usarlo al crear un frente de trabajo.

Esta pantalla es el catálogo de categorías que se pueden asignar a un frente de trabajo, como Desquinche, Rampa o Banco. Cada tipo cuenta con un nombre y una abreviatura; esta última es la que se usa como identificador dentro del código del frente.

El botón "¿Cómo funciona?" explica la relación con Frentes de Trabajo: al crear o editar un frente, se elige uno de estos tipos, así que si necesita uno que todavía no existe, debe crearlo primero acá. También advierte que un tipo con frentes asociados no se puede eliminar; antes hay que reasignar esos frentes a otro tipo.

Para crear uno nuevo, seleccione Nuevo Tipo. Ingrese el nombre del tipo y, de forma opcional, la abreviatura —que se guarda en mayúsculas— y una breve descripción. A medida que escribe la abreviatura, el sistema muestra una vista previa de cómo se vería dentro del código del frente. Una vez completada la información, seleccione Guardar Tipo.

El listado muestra el nombre, la abreviatura, la descripción, la cantidad de frentes de trabajo que utilizan ese tipo, la fecha de creación, y las acciones para editar o eliminar cada registro.

---

## Estado de Frentes

Continuamos con Estado de Frentes.

El objetivo de esta funcionalidad es anticipar atrasos en la operación: permite hacer seguimiento al avance real de cada frente de trabajo, comparando lo planificado con lo efectivamente ejecutado en terreno.

Para registrar el seguimiento de un frente, seleccione Nuevo Registro.

Deberá indicar el frente de trabajo correspondiente, su nivel de ventilación, en una escala de uno a cinco, y su estabilidad, clasificada en categorías como Frente Cerrada, Acuñadura o Frente en Observación, entre otras.

A continuación, ingrese la duración estimada en días y la fecha de inicio planificada para ese frente. De forma opcional, podrá agregar una observación adicional.

Una vez completada la información, seleccione Guardar para registrar el seguimiento, o Cancelar si desea salir sin guardar los cambios.

Una vez que el frente comienza a operar en terreno, podrá marcar su inicio real desde el listado, indicando la fecha en que efectivamente comenzó.

Con esta información, el sistema calculará automáticamente el desvío entre la fecha planificada y la fecha real de inicio, por lo que no será necesario realizar este cálculo manualmente.

Según el desvío registrado, cada frente quedará clasificado mediante un semáforo de estado: Sin iniciar, En tiempo, Atraso leve —de uno a cinco días— o Atraso grave —más de cinco días—. Esto permite identificar rápidamente los frentes que requieren atención.

Esta sección se organiza en tres pestañas: Resumen, Registros y Análisis.

La pestaña Resumen presenta una visión general de los frentes, incluyendo la cantidad de frentes en tiempo, con atraso o sin iniciar, junto con una tarjeta individual para cada frente y su estado actual.

La pestaña Registros presenta el detalle completo de los seguimientos en formato de tabla, donde será posible editar o eliminar un registro cuando corresponda.

Finalmente, la pestaña Análisis entrega estadísticas de cumplimiento, como el porcentaje de frentes que se iniciaron a tiempo, el desvío promedio, el mejor y peor caso registrado, y un desglose del desvío promedio según el tipo de estabilidad del frente.

Además, al seleccionar ¿Cómo funciona?, podrá consultar una explicación sobre los datos registrados en esta sección, el cálculo del desvío y los criterios utilizados para determinar el semáforo de estado.

De esta manera, Estado de Frentes permite anticipar atrasos y evaluar, con datos reales, qué condiciones de terreno pueden tener un mayor impacto en la planificación.

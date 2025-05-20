#' Adds a group of tabs to a website
#'
#' Adds a group of tabs, each of which contains input and/or output components.
#'
#' @param ... A separately entered list for each tab and its content. Named entries in each tab entry can be
#' \code{"name"} (for the text appearing in the navigation tab), \code{"id"}, \code{"class"}, and \code{"condition"}.
#' Unnamed entries in each list entry are considered the content to be added to the tab's pane. See examples.
#' @param id Unique ID of the tabgroup.
#' @param class A class name to add to the tabgroup.
#' @param condition A string representing the display condition of the entire tabgroup.
#' @details See the \href{https://getbootstrap.com/docs/5.1/layout/grid}{Bootstrap grid documentation}.
#' @examples
#' \dontrun{
#' page_tabgroup(
#'   "Map" = list(id = "map_tab", output_map()),
#'   "Data" = list(output_table()),
#' )
#' }
#' @return A character vector of the content to be added.
#' @export

page_tabgroup <- function(..., id = NULL, class = NULL, condition = NULL) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  parts <- new.env()
  attr(parts, "name") <- "community_site_parts"
  parts$uid <- caller$uid
  elements <- substitute(...())
  n <- length(elements)
  pre <- if (!is.null(id)) id else paste0("tg", parts$uid)
  ids <- paste0(pre, seq_len(n))
  head <- rep(
    '<button type="button" data-bs-toggle="tab" aria-controls="',
    n
  )
  body <- rep('<div role="tabpanel" aria-labelledby="', n)
  for (i in seq_along(elements)) {
    e <- elements[[i]]
    ns <- names(e)
    if (!"name" %in% ns) e$name <- names(elements)[i]
    if (!"id" %in% ns) e$id <- ids[i]
    if (!"class" %in% ns) e$class <- ""
    if (!"condition" %in% ns) e$condition <- ""
    head[i] <- paste(
      c(
        head[i],
        e$id,
        '" class="nav-link',
        if (i == 1) " active",
        if (i == 1) '" aria-current="page',
        '" data-bs-target="#',
        e$id,
        '" id="',
        e$id,
        '-tab">',
        e$name,
        "</button>"
      ),
      collapse = ""
    )
    body[i] <- paste0(
      c(
        body[i],
        e$id,
        '-tab" class="tab-pane fade',
        if (i == 1) " show active",
        if (e$class != "") c(" ", e$class),
        '" id="',
        e$id,
        '"',
        if (e$condition != "") c(' condition="', e$condition, '"'),
        ">",
        unlist(eval(e[names(e) == ""], parts), use.names = FALSE),
        "</div>"
      ),
      collapse = ""
    )
  }
  r <- c(
    "<nav>",
    paste(
      c(
        "<div",
        if (!is.null(id)) c(' id="', id, '"'),
        ' class="nav nav-tabs',
        if (!is.null(class)) c(" ", class),
        '"',
        if (!is.null(condition)) c(' condition="', condition, '"'),
        ">"
      ),
      collapse = ""
    ),
    head,
    "</div>",
    "</nav>",
    '<div class="tab-content">',
    body,
    "</div>"
  )
  if (building) {
    caller$content <- c(caller$content, r)
    for (n in names(parts))
      if (n != "content" && n != "uid")
        caller[[n]] <- c(caller[[n]], parts[[n]])
    caller$uid <- parts$uid + 1
  }
  r
}

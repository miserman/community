#' Write content to the head of a website
#'
#' Adds to the \code{<head>} tag of a page being build with \code{\link{site_build}}.
#'
#' @param ... Content to be added to the \code{<head>} tag, such as a \code{<meta>} or \code{<link>} tag.
#' @param title Text to appear as the site's name (as in a browser tab); added to a \code{<title>} tag.
#' @param description Text describing the site; added to a \code{<meta>} tag.
#' @param icon Path to an image for the site's icon.
#' @examples
#' \dontrun{
#' page_head(title = "Site Name")
#' }
#' @return A character vector of the content to be added.
#' @export

page_head <- function(..., title = "", description = "", icon = "") {
  r <- lapply(list(...), as.character)
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  if (building)
    for (e in names(caller$head))
      if (!e %in% names(r)) r[[e]] <- caller$head[[e]]
  if (!missing(title)) {
    r$title <- c(
      paste0("<title>", title, "</title>"),
      paste0('<meta name="title" content="', title, '">')
    )
  }
  if (!missing(description))
    r$description <- paste0(
      '<meta name="description" content="',
      description,
      '">'
    )
  if (!missing(icon)) r$icon <- paste0('<link rel="icon" href="', icon, '">')
  if (building) caller$head <- r
  r
}
